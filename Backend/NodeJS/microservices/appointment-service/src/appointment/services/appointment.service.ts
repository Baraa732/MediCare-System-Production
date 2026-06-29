import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, MoreThanOrEqual } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
  PatientAppointmentGroup,
} from '../dto/appointment.dto';
import { UserHttpClient } from './user-http.client';
import { ClinicHttpClient } from './clinic-http.client';
import { SchedulingHttpClient } from './scheduling-http.client';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { tenantFindWhere } from '../../tenant-shared/tenant-query.util';

export interface AuthUser {
  userId: string;
  role: string;
  tenantId?: string;
}

const ACTIVE_STATUSES = [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED];

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientProxy,
    private readonly userHttpClient: UserHttpClient,
    private readonly clinicHttpClient: ClinicHttpClient,
    private readonly schedulingHttpClient: SchedulingHttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateAppointmentDto, actor: AuthUser): Promise<Appointment> {
    const patientId = this.resolvePatientId(dto, actor);
    await this.assertCanCreate(dto, actor, patientId);

    const doctor = await this.userHttpClient.getUserById(dto.doctorId);
    if (doctor.role !== 'DOCTOR') {
      throw new BadRequestException('Selected user is not a doctor');
    }

    const patient = await this.userHttpClient.getUserById(patientId);
    if (patient.role !== 'PATIENT') {
      throw new BadRequestException('Selected user is not a patient');
    }

    const doctorAssigned = await this.clinicHttpClient.verifyDoctorAtClinic(dto.clinicId, dto.doctorId);
    if (!doctorAssigned) {
      throw new BadRequestException('Doctor is not assigned to this clinic');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Appointment must be scheduled in the future');
    }

    const durationMinutes = dto.durationMinutes ?? 30;
    await this.schedulingHttpClient.validateSlot(
      dto.clinicId,
      dto.doctorId,
      scheduledAt.toISOString(),
      durationMinutes,
    );
    await this.assertNoConflict(dto.clinicId, dto.doctorId, scheduledAt, durationMinutes);

    const appointment = this.appointmentRepo.create({
      clinicId: dto.clinicId,
      doctorId: dto.doctorId,
      patientId,
      scheduledAt,
      durationMinutes,
      reason: dto.reason,
      status: AppointmentStatus.CONFIRMED,
      createdBy: actor.userId,
    });
    const saved = await this.appointmentRepo.save(appointment);

    this.kafkaClient.emit(KafkaTopics.APPOINTMENT_CREATED, this.toEventPayload(saved));

    return saved;
  }

  /** Clinic schedule view — clinic staff (admin, secretary, doctor) and system manager. */
  async findAll(actor: AuthUser, query: AppointmentQueryDto): Promise<Appointment[]> {
    const allowedRoles = ['SECRETARY', 'CLINIC_ADMIN', 'DOCTOR', 'SYSTEM_MANAGER'];
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenException('You are not allowed to view clinic appointment lists');
    }

    const qb = this.appointmentRepo.createQueryBuilder('a').orderBy('a.scheduledAt', 'ASC');

    if (actor.role !== 'SYSTEM_MANAGER') {
      const allowed = await this.clinicHttpClient.checkClinicAccess(query.clinicId, actor.userId);
      if (!allowed) throw new ForbiddenException('You do not have access to this clinic');
    }

    if (actor.role === 'DOCTOR') {
      if (query.doctorId && query.doctorId !== actor.userId) {
        throw new ForbiddenException('You can only view your own appointments');
      }
      if (!query.doctorId) {
        query.doctorId = actor.userId;
      }
    }

    qb.andWhere('a.tenant_id = :tenantId', { tenantId: query.clinicId });

    if (query.doctorId) qb.andWhere('a.doctorId = :doctorId', { doctorId: query.doctorId });
    if (query.patientId) qb.andWhere('a.patientId = :patientId', { patientId: query.patientId });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.from && query.to) {
      qb.andWhere('a.scheduledAt BETWEEN :from AND :to', {
        from: new Date(query.from),
        to: new Date(query.to),
      });
    } else if (query.from) {
      qb.andWhere('a.scheduledAt >= :from', { from: new Date(query.from) });
    } else if (query.to) {
      qb.andWhere('a.scheduledAt <= :to', { to: new Date(query.to) });
    }

    return qb.getMany();
  }

  async findMine(actor: AuthUser, query: PatientAppointmentQueryDto): Promise<Appointment[]> {
    if (actor.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can use this endpoint');
    }

    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.patientId = :patientId', { patientId: actor.userId })
      .orderBy('a.scheduledAt', 'ASC');

    if (query.status) {
      qb.andWhere('a.status = :status', { status: query.status });
    } else if (query.group && query.group !== PatientAppointmentGroup.ALL) {
      const now = new Date();
      switch (query.group) {
        case PatientAppointmentGroup.UPCOMING:
          qb.andWhere('a.status IN (:...active)', {
            active: [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED],
          }).andWhere('a.scheduledAt >= :now', { now });
          break;
        case PatientAppointmentGroup.COMPLETED:
          qb.andWhere('a.status = :completed', { completed: AppointmentStatus.COMPLETED });
          break;
        case PatientAppointmentGroup.CANCELLED:
          qb.andWhere('a.status = :cancelled', { cancelled: AppointmentStatus.CANCELLED });
          break;
        case PatientAppointmentGroup.PAST:
          qb.andWhere(
            '(a.status IN (:...done) OR (a.status IN (:...active) AND a.scheduledAt < :now))',
            {
              done: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW],
              active: [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED],
              now,
            },
          );
          break;
      }
    }

    return qb.getMany();
  }

  async findOne(id: string, actor: AuthUser): Promise<Appointment> {
    const tenantId = this.resolveQueryTenantId(actor);
    const where = tenantId
      ? tenantFindWhere(tenantId, { id })
      : { id };
    const appointment = await this.appointmentRepo.findOne({ where });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.assertCanView(appointment, actor);
    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto, actor: AuthUser): Promise<Appointment> {
    const appointment = await this.findOne(id, actor);
    await this.assertCanManage(appointment, actor);

    if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot update a cancelled or completed appointment');
    }

    const targetDoctorId = dto.doctorId ?? appointment.doctorId;
    if (dto.doctorId && dto.doctorId !== appointment.doctorId) {
      const doctor = await this.userHttpClient.getUserById(dto.doctorId);
      if (doctor.role !== 'DOCTOR') {
        throw new BadRequestException('Selected user is not a doctor');
      }
      const doctorAssigned = await this.clinicHttpClient.verifyDoctorAtClinic(
        appointment.clinicId,
        dto.doctorId,
      );
      if (!doctorAssigned) {
        throw new BadRequestException('Doctor is not assigned to this clinic');
      }
      appointment.doctorId = dto.doctorId;
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : appointment.scheduledAt;
    const duration = dto.durationMinutes ?? appointment.durationMinutes;

    if (dto.scheduledAt || dto.durationMinutes !== undefined || dto.doctorId) {
      if (scheduledAt <= new Date()) {
        throw new BadRequestException('Appointment must be scheduled in the future');
      }
      await this.schedulingHttpClient.validateSlot(
        appointment.clinicId,
        targetDoctorId,
        scheduledAt.toISOString(),
        duration,
      );
      await this.assertNoConflict(
        appointment.clinicId,
        targetDoctorId,
        scheduledAt,
        duration,
        appointment.id,
      );
      if (dto.scheduledAt) {
        appointment.scheduledAt = scheduledAt;
      }
    }

    if (dto.durationMinutes !== undefined) appointment.durationMinutes = dto.durationMinutes;
    if (dto.reason !== undefined) appointment.reason = dto.reason;
    if (dto.notes !== undefined) appointment.notes = dto.notes;

    const saved = await this.appointmentRepo.save(appointment);
    this.kafkaClient.emit(KafkaTopics.APPOINTMENT_UPDATED, this.toEventPayload(saved));
    return saved;
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto, actor: AuthUser): Promise<Appointment> {
    const tenantId = this.resolveQueryTenantId(actor);
    const where = tenantId ? tenantFindWhere(tenantId, { id }) : { id };
    const appointment = await this.appointmentRepo.findOne({ where });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.assertCanChangeStatus(appointment, actor, dto.status);
    this.assertValidStatusTransition(appointment.status, dto.status, actor, appointment);

    if (dto.status === AppointmentStatus.CANCELLED) {
      appointment.cancelledBy = actor.userId;
      appointment.cancelledAt = new Date();
      appointment.cancellationReason = dto.cancellationReason;
    }

    appointment.status = dto.status;
    const saved = await this.appointmentRepo.save(appointment);

    const topic =
      dto.status === AppointmentStatus.CANCELLED
        ? KafkaTopics.APPOINTMENT_CANCELLED
        : dto.status === AppointmentStatus.COMPLETED
          ? KafkaTopics.APPOINTMENT_COMPLETED
          : KafkaTopics.APPOINTMENT_UPDATED;

    this.kafkaClient.emit(topic, this.toEventPayload(saved));
    return saved;
  }

  toPublic(appointment: Appointment) {
    return {
      id: appointment.id,
      clinicId: appointment.clinicId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      scheduledAt: appointment.scheduledAt,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.notes,
      createdBy: appointment.createdBy,
      cancelledBy: appointment.cancelledBy,
      cancelledAt: appointment.cancelledAt,
      cancellationReason: appointment.cancellationReason,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }

  async toPublicEnriched(appointment: Appointment) {
    const base = this.toPublic(appointment);
    const [clinic, doctors] = await Promise.all([
      this.clinicHttpClient.getClinicById(appointment.clinicId),
      this.userHttpClient.getPublicDoctors([appointment.doctorId]),
    ]);
    const doctor = doctors[0];
    return {
      ...base,
      clinicName: clinic?.name,
      clinicAddress: clinic?.address,
      clinicCity: clinic?.city,
      clinicGovernorate: clinic?.governorate,
      clinicPhone: clinic?.phone,
      doctorName: doctor ? `${doctor.firstName} ${doctor.lastName}`.trim() : undefined,
      doctorSpecialization: doctor?.specialization,
    };
  }

  async toPublicEnrichedMany(appointments: Appointment[]) {
    if (!appointments.length) return [];

    const clinicIds = [...new Set(appointments.map((a) => a.clinicId))];
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];

    const [clinics, doctors] = await Promise.all([
      this.clinicHttpClient.getClinicsByIds(clinicIds),
      this.userHttpClient.getPublicDoctors(doctorIds),
    ]);

    const clinicMap = new Map(clinics.map((c) => [c.id, c]));
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    return appointments.map((appointment) => {
      const base = this.toPublic(appointment);
      const clinic = clinicMap.get(appointment.clinicId);
      const doctor = doctorMap.get(appointment.doctorId);
      return {
        ...base,
        clinicName: clinic?.name,
        clinicAddress: clinic?.address,
        clinicCity: clinic?.city,
        clinicGovernorate: clinic?.governorate,
        clinicPhone: clinic?.phone,
        doctorName: doctor ? `${doctor.firstName} ${doctor.lastName}`.trim() : undefined,
        doctorSpecialization: doctor?.specialization,
      };
    });
  }

  async getBookedRangesForDay(clinicId: string, doctorId: string, date: string) {
    const tenantId = clinicId;
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const appointments = await this.appointmentRepo.find({
      where: {
        tenantId,
        doctorId,
        status: In(ACTIVE_STATUSES),
        scheduledAt: Between(dayStart, dayEnd),
      },
    });

    return appointments.map((a) => ({
      start: a.scheduledAt.toISOString(),
      end: new Date(a.scheduledAt.getTime() + a.durationMinutes * 60_000).toISOString(),
    }));
  }

  async getPatientUpcomingSummary(patientId: string, limit = 3) {
    const now = new Date();
    const appointments = await this.appointmentRepo.find({
      where: {
        patientId,
        status: In(ACTIVE_STATUSES),
        scheduledAt: MoreThanOrEqual(now),
      },
      order: { scheduledAt: 'ASC' },
      take: limit,
    });

    const enriched = await this.toPublicEnrichedMany(appointments);
    return enriched.map((a) => ({
      appointmentId: a.id,
      clinicName: a.clinicName,
      doctorName: a.doctorName,
      scheduledAt: a.scheduledAt,
      status: a.status,
    }));
  }

  async verifyOwnership(patientId: string, appointmentId: string): Promise<boolean> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { id: appointmentId, patientId };
    if (tenantId) where.tenantId = tenantId;
    const appointment = await this.appointmentRepo.findOne({ where });
    if (!appointment) return false;
    if (tenantId && appointment.tenantId !== tenantId) return false;
    return appointment.patientId === patientId;
  }

  private resolveQueryTenantId(actor: AuthUser): string | null {
    if (['SYSTEM_MANAGER', 'PATIENT'].includes(actor.role)) return null;
    return actor.tenantId ?? this.tenantContext.getTenantId();
  }

  private resolvePatientId(dto: CreateAppointmentDto, actor: AuthUser): string {
    if (actor.role === 'PATIENT') return actor.userId;
    if (!dto.patientId) throw new BadRequestException('patientId is required when booking for another patient');
    return dto.patientId;
  }

  private async assertCanCreate(dto: CreateAppointmentDto, actor: AuthUser, patientId: string) {
    if (actor.role === 'PATIENT') return;
    if (['SECRETARY', 'CLINIC_ADMIN'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(dto.clinicId, actor.userId);
      if (!allowed) throw new ForbiddenException('You do not have access to this clinic');
      return;
    }
    if (actor.role === 'SYSTEM_MANAGER') return;
    throw new ForbiddenException('You are not allowed to create appointments');
  }

  private async assertCanView(appointment: Appointment, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (actor.role === 'PATIENT' && actor.userId === appointment.patientId) return;
    if (actor.role === 'DOCTOR' && actor.userId === appointment.doctorId) return;
    if (['SECRETARY', 'CLINIC_ADMIN'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(appointment.clinicId, actor.userId);
      if (allowed) return;
    }
    throw new ForbiddenException('You do not have access to this appointment');
  }

  private async assertCanChangeStatus(
    appointment: Appointment,
    actor: AuthUser,
    nextStatus: AppointmentStatus,
  ) {
    if (actor.role === 'SYSTEM_MANAGER') return;

    if (actor.role === 'PATIENT' && actor.userId === appointment.patientId) {
      if (nextStatus === AppointmentStatus.CANCELLED) return;
      throw new ForbiddenException('Patients can only cancel their own appointments');
    }

    if (['SECRETARY', 'CLINIC_ADMIN'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(appointment.clinicId, actor.userId);
      if (allowed) return;
    }

    if (
      actor.role === 'DOCTOR' &&
      actor.userId === appointment.doctorId &&
      [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW].includes(nextStatus)
    ) {
      return;
    }

    throw new ForbiddenException('You cannot change this appointment status');
  }

  private async assertCanManage(appointment: Appointment, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (actor.userId === appointment.patientId) return;
    if (['CLINIC_ADMIN', 'SECRETARY'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(appointment.clinicId, actor.userId);
      if (allowed) return;
    }
    throw new ForbiddenException('You cannot modify this appointment');
  }

  private assertValidStatusTransition(
    current: AppointmentStatus,
    next: AppointmentStatus,
    actor: AuthUser,
    appointment: Appointment,
  ) {
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      [AppointmentStatus.REQUESTED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
      [AppointmentStatus.CONFIRMED]: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.NO_SHOW]: [],
    };

    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(`Cannot transition from ${current} to ${next}`);
    }

    if (next === AppointmentStatus.COMPLETED || next === AppointmentStatus.NO_SHOW) {
      if (!['DOCTOR', 'CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER'].includes(actor.role)) {
        throw new ForbiddenException('Only clinic staff or doctor can complete appointments');
      }
      if (actor.role === 'DOCTOR' && actor.userId !== appointment.doctorId) {
        throw new ForbiddenException('Only the assigned doctor can complete this appointment');
      }
    }

    if (next === AppointmentStatus.CANCELLED) {
      if (actor.role === 'PATIENT' && actor.userId !== appointment.patientId) {
        throw new ForbiddenException('Patients can only cancel their own appointments');
      }
    }
  }

  private async assertNoConflict(
    clinicId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeId?: string,
  ) {
    const start = scheduledAt.getTime();
    const end = start + durationMinutes * 60_000;

    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId: clinicId })
      .andWhere('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_STATUSES });

    if (excludeId) qb.andWhere('a.id != :excludeId', { excludeId });

    const existing = await qb.getMany();

    for (const appt of existing) {
      const existingStart = appt.scheduledAt.getTime();
      const existingEnd = existingStart + appt.durationMinutes * 60_000;
      if (start < existingEnd && end > existingStart) {
        throw new ConflictException('Doctor already has an appointment at this time');
      }
    }
  }

  private toEventPayload(appointment: Appointment) {
    const payload = {
      appointmentId: appointment.id,
      tenantId: appointment.tenantId,
      clinicId: appointment.tenantId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      scheduledAt: appointment.scheduledAt.toISOString(),
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
    };
    return withTenantEvent(appointment.tenantId, payload);
  }
}
