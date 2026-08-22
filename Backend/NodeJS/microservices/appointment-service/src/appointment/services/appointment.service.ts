import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, In, Between, MoreThanOrEqual } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { PatientClinicRelation } from '../entities/patient-clinic-relation.entity';
import {
  DoctorPatientAssignment,
  DoctorPatientAssignmentStatus,
} from '../entities/doctor-patient-assignment.entity';
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
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { tenantFindWhere } from '../../tenant-shared/tenant-query.util';
import { SignedKafkaPublisher } from '../../kafka-security-shared/signed-kafka.publisher';
import { PhiAuditPublisherService } from '../../phi-audit-shared/phi-audit.publisher';
import { PhiAuditAction, PhiAuditResourceType } from '../../phi-audit-shared/types';

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
    @InjectRepository(PatientClinicRelation)
    private readonly patientClinicRepo: Repository<PatientClinicRelation>,
    @InjectRepository(DoctorPatientAssignment)
    private readonly doctorPatientRepo: Repository<DoctorPatientAssignment>,
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientProxy,
    private readonly signedKafka: SignedKafkaPublisher,
    private readonly userHttpClient: UserHttpClient,
    private readonly clinicHttpClient: ClinicHttpClient,
    private readonly schedulingHttpClient: SchedulingHttpClient,
    private readonly tenantContext: TenantContextService,
    private readonly phiAudit: PhiAuditPublisherService,
    private readonly dataSource: DataSource,
  ) {}

  private auditAppointment(
    action: PhiAuditAction,
    actor: AuthUser,
    resourceId: string | undefined,
    tenantId: string | undefined,
    success: boolean,
    internalCall = false,
  ): void {
    this.phiAudit.emit({
      action,
      actorId: actor?.userId,
      actorRole: actor?.role,
      tenantId: tenantId ?? this.tenantContext.getTenantId() ?? undefined,
      resourceType: PhiAuditResourceType.APPOINTMENT,
      resourceId,
      success,
      classification: 'phi',
      internalCall,
    });
  }

  async create(dto: CreateAppointmentDto, actor: AuthUser): Promise<Appointment> {
    const patientId = this.resolvePatientId(dto, actor);
    await this.assertCanCreate(dto, actor, patientId);

    const doctor = await this.userHttpClient.getUserById(dto.doctorId);
    if (doctor.role !== 'DOCTOR') {
      throw new BadRequestException('Selected user is not a doctor');
    }

    if (patientId) {
      const patient = await this.userHttpClient.getUserById(patientId);
      if (patient.role !== 'PATIENT') {
        throw new BadRequestException('Selected user is not a patient');
      }
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
      actor.role === 'PATIENT',
    );
    // Patients request; clinic staff (secretary/admin) can book as confirmed.
    const initialStatus =
      actor.role === 'PATIENT' ? AppointmentStatus.REQUESTED : AppointmentStatus.CONFIRMED;

    const appointment = this.appointmentRepo.create({
      tenantId: dto.clinicId,
      doctorId: dto.doctorId,
      patientId,
      guestPatientName: patientId ? null : dto.guestPatientName?.trim() || null,
      guestPatientPhone: patientId ? null : dto.guestPatientPhone?.trim() || null,
      scheduledAt,
      durationMinutes,
      reason: dto.reason,
      notes: dto.notes?.trim() || null,
      status: initialStatus,
      createdBy: actor.userId,
    });
    const saved = await this.saveAppointmentAtomic(
      appointment,
      dto.clinicId,
      dto.doctorId,
      scheduledAt,
      durationMinutes,
    );
    if (patientId) {
      await this.ensurePatientClinicRelation(patientId, dto.clinicId);
      await this.ensureDoctorPatientAssignment(
        dto.clinicId,
        dto.doctorId,
        patientId,
        actor.userId,
      );
    }

    this.signedKafka.emit(KafkaTopics.APPOINTMENT_CREATED, this.toEventPayload(saved));

    this.auditAppointment(
      PhiAuditAction.APPOINTMENT_CREATE,
      actor,
      saved.id,
      saved.tenantId,
      true,
    );

    return saved;
  }

  async hasPatientClinicAccess(patientId: string, clinicId: string): Promise<boolean> {
    const relation = await this.patientClinicRepo.findOne({
      where: { patientId, tenantId: clinicId },
    });
    if (relation) return true;

    const appointment = await this.appointmentRepo.findOne({
      where: { patientId, tenantId: clinicId },
    });
    return Boolean(appointment);
  }

  async hasDoctorPatientAccess(
    tenantId: string,
    doctorId: string,
    patientId: string,
  ): Promise<boolean> {
    const assignment = await this.doctorPatientRepo.findOne({
      where: {
        tenantId,
        doctorId,
        patientId,
        status: DoctorPatientAssignmentStatus.ACTIVE,
      },
    });
    if (assignment) return true;

    const appointment = await this.appointmentRepo.findOne({
      where: { tenantId, doctorId, patientId },
    });
    return Boolean(appointment);
  }

  async ensureDoctorPatientAssignment(
    tenantId: string,
    doctorId: string,
    patientId: string,
    assignedBy: string,
  ): Promise<void> {
    const existing = await this.doctorPatientRepo.findOne({
      where: { tenantId, doctorId, patientId },
    });

    if (existing) {
      existing.status = DoctorPatientAssignmentStatus.ACTIVE;
      existing.assignedBy = assignedBy;
      existing.updatedAt = new Date();
      await this.doctorPatientRepo.save(existing);
      return;
    }

    await this.doctorPatientRepo.save(
      this.doctorPatientRepo.create({
        tenantId,
        doctorId,
        patientId,
        assignedBy,
        status: DoctorPatientAssignmentStatus.ACTIVE,
      }),
    );
  }

  async ensurePatientClinicRelation(patientId: string, clinicId: string): Promise<void> {
    const existing = await this.patientClinicRepo.findOne({
      where: { patientId, tenantId: clinicId },
    });
    if (existing) {
      existing.lastSeenAt = new Date();
      await this.patientClinicRepo.save(existing);
      return;
    }

    await this.patientClinicRepo.save(
      this.patientClinicRepo.create({ patientId, tenantId: clinicId }),
    );
  }

  /** Clinic schedule view — clinic staff (admin, secretary, doctor) and system manager. */
  async findAll(actor: AuthUser, query: AppointmentQueryDto): Promise<Appointment[]> {
    const allowedRoles = ['SECRETARY', 'CLINIC_ADMIN', 'DOCTOR', 'SYSTEM_MANAGER'];
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenException('You are not allowed to view clinic appointment lists');
    }

    const qb = this.appointmentRepo.createQueryBuilder('a').orderBy('a.scheduledAt', 'ASC');

    if (actor.role !== 'SYSTEM_MANAGER') {
      const allowed = await this.clinicHttpClient.checkClinicAccess(query.clinicId, actor.userId, actor.role);
      if (!allowed) throw new ForbiddenException('You do not have access to this clinic');
    }

    if (actor.role === 'DOCTOR') {
      if (query.doctorId && query.doctorId !== actor.userId) {
        throw new ForbiddenException('You can only view your own appointments');
      }
      if (!query.doctorId) {
        query.doctorId = actor.userId;
      }
      if (query.patientId) {
        const assigned = await this.hasDoctorPatientAccess(
          query.clinicId,
          actor.userId,
          query.patientId,
        );
        if (!assigned) {
          throw new ForbiddenException('You are not assigned to this patient in this clinic');
        }
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

    const results = await qb.getMany();
    this.auditAppointment(
      PhiAuditAction.APPOINTMENT_READ,
      actor,
      query.clinicId,
      query.clinicId,
      true,
    );
    return results;
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

    const results = await qb.getMany();
    this.auditAppointment(
      PhiAuditAction.APPOINTMENT_READ,
      actor,
      actor.userId,
      this.tenantContext.getTenantId() ?? undefined,
      true,
    );
    return results;
  }

  async findOne(id: string, actor: AuthUser): Promise<Appointment> {
    const tenantId = this.resolveQueryTenantId(actor);
    const where = tenantId
      ? tenantFindWhere(tenantId, { id })
      : { id };
    const appointment = await this.appointmentRepo.findOne({ where });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.assertCanView(appointment, actor);
    this.auditAppointment(
      PhiAuditAction.APPOINTMENT_READ,
      actor,
      appointment.id,
      appointment.tenantId,
      true,
    );
    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto, actor: AuthUser): Promise<Appointment> {
    const appointment = await this.findOne(id, actor);
    await this.assertCanManage(appointment, actor);

    if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot update a cancelled or completed appointment');
    }

    const previousScheduledAt = appointment.scheduledAt;
    const previousDoctorId = appointment.doctorId;
    const previousDuration = appointment.durationMinutes;

    const targetDoctorId = dto.doctorId ?? appointment.doctorId;
    const doctorReassigned = Boolean(dto.doctorId && dto.doctorId !== appointment.doctorId);
    if (doctorReassigned) {
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

    const needsConflictCheck = !!(dto.scheduledAt || dto.durationMinutes !== undefined || dto.doctorId);
    const batchExcludeIds = [
      ...(dto.excludeAppointmentIds ?? []),
      appointment.id,
    ];
    if (needsConflictCheck) {
      const unchangedTime =
        Math.abs(scheduledAt.getTime() - appointment.scheduledAt.getTime()) < 60_000;
      // Allow tiny clock skew; skip "future" check when time is unchanged (revert / no-op).
      if (!unchangedTime && scheduledAt.getTime() <= Date.now() - 60_000) {
        throw new BadRequestException('Appointment must be scheduled in the future');
      }
      await this.schedulingHttpClient.validateSlot(
        appointment.clinicId,
        targetDoctorId,
        scheduledAt.toISOString(),
        duration,
        actor.role === 'PATIENT',
        appointment.id,
        batchExcludeIds,
      );
      if (dto.scheduledAt) {
        appointment.scheduledAt = scheduledAt;
      }
    }

    if (dto.durationMinutes !== undefined) appointment.durationMinutes = dto.durationMinutes;
    if (dto.reason !== undefined) appointment.reason = dto.reason;
    if (dto.notes !== undefined) appointment.notes = dto.notes;

    const saved = needsConflictCheck
      ? await this.saveAppointmentAtomic(
          appointment,
          appointment.clinicId,
          targetDoctorId,
          scheduledAt,
          duration,
          batchExcludeIds,
        )
      : await this.appointmentRepo.save(appointment);
    if (doctorReassigned) {
      await this.ensureDoctorPatientAssignment(
        saved.clinicId,
        saved.doctorId,
        saved.patientId,
        actor.userId,
      );
    }

    // Notes/reason-only saves must not look like a reschedule to patients or staff.
    if (this.didScheduleChange(previousScheduledAt, previousDoctorId, previousDuration, saved)) {
      this.signedKafka.emit(
        KafkaTopics.APPOINTMENT_UPDATED,
        this.toEventPayload(saved, {
          changeKind: 'RESCHEDULED',
          previousStatus: saved.status,
          previousScheduledAt: previousScheduledAt.toISOString(),
          previousDoctorId,
        }),
      );
    }

    this.auditAppointment(
      PhiAuditAction.APPOINTMENT_UPDATE,
      actor,
      saved.id,
      saved.tenantId,
      true,
    );
    return saved;
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto, actor: AuthUser): Promise<Appointment> {
    const tenantId = this.resolveQueryTenantId(actor);
    const where = tenantId ? tenantFindWhere(tenantId, { id }) : { id };
    const appointment = await this.appointmentRepo.findOne({ where });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.assertCanChangeStatus(appointment, actor, dto.status);
    this.assertValidStatusTransition(appointment.status, dto.status, actor, appointment);

    const previousStatus = appointment.status;

    if (dto.status === AppointmentStatus.CANCELLED) {
      appointment.cancelledBy = actor.userId;
      appointment.cancelledAt = new Date();
      appointment.cancellationReason = dto.cancellationReason;
    }

    appointment.status = dto.status;
    const saved = await this.appointmentRepo.save(appointment);

    if (dto.status === AppointmentStatus.CANCELLED) {
      this.signedKafka.emit(
        KafkaTopics.APPOINTMENT_CANCELLED,
        this.toEventPayload(saved, {
          changeKind: 'CANCELLED',
          previousStatus,
        }),
      );
    } else if (dto.status === AppointmentStatus.COMPLETED) {
      this.signedKafka.emit(
        KafkaTopics.APPOINTMENT_COMPLETED,
        this.toEventPayload(saved, {
          changeKind: 'COMPLETED',
          previousStatus,
        }),
      );
    } else if (
      dto.status === AppointmentStatus.CONFIRMED &&
      previousStatus === AppointmentStatus.REQUESTED
    ) {
      this.signedKafka.emit(
        KafkaTopics.APPOINTMENT_UPDATED,
        this.toEventPayload(saved, {
          changeKind: 'CONFIRMED',
          previousStatus,
        }),
      );
    } else if (dto.status === AppointmentStatus.NO_SHOW) {
      this.signedKafka.emit(
        KafkaTopics.APPOINTMENT_UPDATED,
        this.toEventPayload(saved, {
          changeKind: 'NO_SHOW',
          previousStatus,
        }),
      );
    } else if (previousStatus !== dto.status) {
      this.signedKafka.emit(
        KafkaTopics.APPOINTMENT_UPDATED,
        this.toEventPayload(saved, {
          changeKind: 'STATUS',
          previousStatus,
        }),
      );
    }

    this.auditAppointment(
      dto.status === AppointmentStatus.CANCELLED
        ? PhiAuditAction.APPOINTMENT_DELETE
        : PhiAuditAction.APPOINTMENT_UPDATE,
      actor,
      saved.id,
      saved.tenantId,
      true,
    );

    return saved;
  }

  toPublic(appointment: Appointment) {
    return {
      id: appointment.id,
      clinicId: appointment.clinicId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      guestPatientName: appointment.guestPatientName,
      guestPatientPhone: appointment.guestPatientPhone,
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
    const [clinic, doctors, patient] = await Promise.all([
      this.clinicHttpClient.getClinicById(appointment.clinicId),
      this.userHttpClient.getPublicDoctors([appointment.doctorId]),
      appointment.patientId
        ? this.userHttpClient.getUserById(appointment.patientId).catch(() => null)
        : Promise.resolve(null),
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
      doctorAvatarUrl: doctor?.avatarUrl,
      patientName:
        (patient
          ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || undefined
          : undefined) ?? appointment.guestPatientName ?? undefined,
      patientGender: patient?.gender,
      patientBirthDate: patient?.birthDate,
      patientPhone: patient?.phoneNumber ?? appointment.guestPatientPhone ?? undefined,
      patientAvatarUrl: patient?.avatarUrl,
    };
  }

  async toPublicEnrichedMany(appointments: Appointment[]) {
    if (!appointments.length) return [];

    const clinicIds = [...new Set(appointments.map((a) => a.clinicId))];
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
    const patientIds = [
      ...new Set(
        appointments
          .map((a) => a.patientId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [clinics, doctors, patients] = await Promise.all([
      this.clinicHttpClient.getClinicsByIds(clinicIds),
      this.userHttpClient.getPublicDoctors(doctorIds),
      this.userHttpClient.getPublicPatients(patientIds),
    ]);

    const clinicMap = new Map(clinics.map((c) => [c.id, c]));
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    return appointments.map((appointment) => {
      const base = this.toPublic(appointment);
      const clinic = clinicMap.get(appointment.clinicId);
      const doctor = doctorMap.get(appointment.doctorId);
      const patient = appointment.patientId
        ? patientMap.get(appointment.patientId)
        : undefined;
      return {
        ...base,
        clinicName: clinic?.name,
        clinicAddress: clinic?.address,
        clinicCity: clinic?.city,
        clinicGovernorate: clinic?.governorate,
        clinicPhone: clinic?.phone,
        doctorName: doctor ? `${doctor.firstName} ${doctor.lastName}`.trim() : undefined,
        doctorSpecialization: doctor?.specialization,
        doctorAvatarUrl: doctor?.avatarUrl,
        patientName:
          (patient
            ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || undefined
            : undefined) ?? appointment.guestPatientName ?? undefined,
        patientGender: patient?.gender,
        patientBirthDate: patient?.birthDate,
        patientPhone: patient?.phoneNumber ?? appointment.guestPatientPhone ?? undefined,
        patientAvatarUrl: patient?.avatarUrl,
      };
    });
  }

  async getBookedRangesForDay(
    clinicId: string,
    doctorId: string,
    date: string,
    excludeAppointmentId?: string,
    excludeAppointmentIds?: string[],
  ) {
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

    const exclude = new Set<string>([
      ...(excludeAppointmentIds ?? []),
      ...(excludeAppointmentId ? [excludeAppointmentId] : []),
    ]);

    return appointments
      .filter((a) => !exclude.has(a.id))
      .map((a) => ({
        start: a.scheduledAt.toISOString(),
        end: new Date(a.scheduledAt.getTime() + a.durationMinutes * 60_000).toISOString(),
      }));
  }

  /**
   * Internal: cancel active appointments overlapping [from, to) for a clinic
   * (optionally scoped to one doctor). Emits appointment.cancelled for each.
   */
  async cancelInRange(params: {
    clinicId: string;
    fromIso: string;
    toIso: string;
    doctorId?: string | null;
    reason: string;
    actorUserId: string;
  }): Promise<{ cancelledCount: number; appointmentIds: string[] }> {
    const from = new Date(params.fromIso);
    const to = new Date(params.toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new BadRequestException('Invalid cancel range');
    }

    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId: params.clinicId })
      .andWhere('a.clinicId = :clinicId', { clinicId: params.clinicId })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('a.scheduledAt >= :from', { from })
      .andWhere('a.scheduledAt < :to', { to });

    if (params.doctorId) {
      qb.andWhere('a.doctorId = :doctorId', { doctorId: params.doctorId });
    }

    const appointments = await qb.getMany();
    if (appointments.length === 0) {
      return { cancelledCount: 0, appointmentIds: [] };
    }

    const now = new Date();
    const reason = params.reason?.trim() || 'Clinic closed';
    const ids: string[] = [];

    for (const appointment of appointments) {
      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancelledBy = params.actorUserId;
      appointment.cancelledAt = now;
      appointment.cancellationReason = reason;
      const saved = await this.appointmentRepo.save(appointment);
      ids.push(saved.id);
      this.signedKafka.emit(KafkaTopics.APPOINTMENT_CANCELLED, this.toEventPayload(saved));
      this.auditAppointment(
        PhiAuditAction.APPOINTMENT_DELETE,
        { userId: params.actorUserId, role: 'SYSTEM', tenantId: params.clinicId },
        saved.id,
        saved.tenantId,
        true,
      );
    }

    return { cancelledCount: ids.length, appointmentIds: ids };
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
    const summary = enriched.map((a) => ({
      appointmentId: a.id,
      clinicName: a.clinicName,
      doctorName: a.doctorName,
      scheduledAt: a.scheduledAt,
      status: a.status,
    }));

    this.phiAudit.emit({
      action: PhiAuditAction.INTERNAL_PHI_ACCESS,
      actorRole: 'internal-service',
      tenantId: this.tenantContext.getTenantId() ?? undefined,
      resourceType: PhiAuditResourceType.APPOINTMENT,
      resourceId: patientId,
      success: true,
      classification: 'phi',
      internalCall: true,
    });

    return summary;
  }

  async verifyOwnership(patientId: string, appointmentId: string): Promise<boolean> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { id: appointmentId, patientId };
    if (tenantId) where.tenantId = tenantId;
    const appointment = await this.appointmentRepo.findOne({ where });
    const owned = Boolean(
      appointment &&
      (!tenantId || appointment.tenantId === tenantId) &&
      appointment.patientId === patientId,
    );

    this.phiAudit.emit({
      action: PhiAuditAction.INTERNAL_PHI_ACCESS,
      actorRole: 'internal-service',
      tenantId: tenantId ?? undefined,
      resourceType: PhiAuditResourceType.APPOINTMENT,
      resourceId: appointmentId,
      success: owned,
      classification: 'phi',
      internalCall: true,
    });

    return owned;
  }

  private resolveQueryTenantId(actor: AuthUser): string | null {
    if (['SYSTEM_MANAGER', 'PATIENT'].includes(actor.role)) return null;
    return actor.tenantId ?? this.tenantContext.getTenantId();
  }

  private resolvePatientId(dto: CreateAppointmentDto, actor: AuthUser): string | null {
    if (actor.role === 'PATIENT') return actor.userId;
    if (dto.patientId) return dto.patientId;
    return null;
  }

  private async assertCanCreate(
    dto: CreateAppointmentDto,
    actor: AuthUser,
    patientId: string | null,
  ) {
    if (actor.role === 'PATIENT') return;
    if (!patientId && !dto.guestPatientName?.trim()) {
      throw new BadRequestException('guestPatientName is required for manual guest appointments');
    }
    if (!patientId && !dto.guestPatientPhone?.trim()) {
      throw new BadRequestException('guestPatientPhone is required for manual guest appointments');
    }
    if (['SECRETARY', 'CLINIC_ADMIN'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(dto.clinicId, actor.userId, actor.role);
      if (!allowed) throw new ForbiddenException('You do not have access to this clinic');
      return;
    }
    if (actor.role === 'SYSTEM_MANAGER') return;
    throw new ForbiddenException('You are not allowed to create appointments');
  }

  private async assertCanView(appointment: Appointment, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (actor.role === 'PATIENT' && actor.userId === appointment.patientId) return;
    if (actor.role === 'DOCTOR') {
      if (actor.userId !== appointment.doctorId) {
        throw new ForbiddenException('You do not have access to this appointment');
      }
      const assigned = await this.hasDoctorPatientAccess(
        appointment.tenantId,
        actor.userId,
        appointment.patientId,
      );
      if (!assigned) {
        throw new ForbiddenException('You are not assigned to this patient in this clinic');
      }
      return;
    }
    if (['SECRETARY', 'CLINIC_ADMIN'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(appointment.clinicId, actor.userId, actor.role);
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
      const allowed = await this.clinicHttpClient.checkClinicAccess(appointment.clinicId, actor.userId, actor.role);
      if (allowed) return;
    }

    if (
      actor.role === 'DOCTOR' &&
      actor.userId === appointment.doctorId &&
      [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CONFIRMED].includes(nextStatus)
    ) {
      return;
    }

    throw new ForbiddenException('You cannot change this appointment status');
  }

  private async assertCanManage(appointment: Appointment, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (actor.userId === appointment.patientId) return;
    if (['CLINIC_ADMIN', 'SECRETARY'].includes(actor.role)) {
      const allowed = await this.clinicHttpClient.checkClinicAccess(appointment.clinicId, actor.userId, actor.role);
      if (allowed) return;
    }
    if (actor.role === 'DOCTOR' && actor.userId === appointment.doctorId) {
      return;
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
      [AppointmentStatus.REQUESTED]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.CANCELLED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
      ],
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

  private isOverlapViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23P01'
    );
  }

  private rethrowIfOverlapViolation(error: unknown): never {
    if (this.isOverlapViolation(error)) {
      throw new ConflictException('Doctor already has an appointment at this time');
    }
    throw error;
  }

  private async acquireDoctorSlotLock(
    manager: EntityManager,
    clinicId: string,
    doctorId: string,
  ): Promise<void> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1::text || ':' || $2::text))`, [
      clinicId,
      doctorId,
    ]);
  }

  private async assertNoConflictWithManager(
    manager: EntityManager,
    clinicId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeIds?: string | string[],
  ): Promise<void> {
    const start = scheduledAt.getTime();
    const end = start + durationMinutes * 60_000;
    const exclude = new Set(
      Array.isArray(excludeIds)
        ? excludeIds.filter(Boolean)
        : excludeIds
          ? [excludeIds]
          : [],
    );

    const qb = manager
      .getRepository(Appointment)
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId: clinicId })
      .andWhere('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_STATUSES });

    if (exclude.size > 0) {
      qb.andWhere('a.id NOT IN (:...excludeIds)', {
        excludeIds: [...exclude],
      });
    }

    const existing = await qb.getMany();

    for (const appt of existing) {
      const existingStart = appt.scheduledAt.getTime();
      const existingEnd = existingStart + appt.durationMinutes * 60_000;
      if (start < existingEnd && end > existingStart) {
        throw new ConflictException('Doctor already has an appointment at this time');
      }
    }
  }

  private async saveAppointmentAtomic(
    appointment: Appointment,
    clinicId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeIds?: string | string[],
  ): Promise<Appointment> {
    return this.dataSource.transaction(async (manager) => {
      await this.acquireDoctorSlotLock(manager, clinicId, doctorId);
      await this.assertNoConflictWithManager(
        manager,
        clinicId,
        doctorId,
        scheduledAt,
        durationMinutes,
        excludeIds,
      );
      try {
        return await manager.save(Appointment, appointment);
      } catch (error) {
        this.rethrowIfOverlapViolation(error);
      }
    });
  }

  async verifyKafkaEvent(input: {
    appointmentId: string;
    tenantId: string;
    patientId?: string;
    doctorId?: string;
    status?: string;
  }): Promise<boolean> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: input.appointmentId, tenantId: input.tenantId },
    });
    if (!appointment) return false;
    if (input.patientId && appointment.patientId !== input.patientId) return false;
    if (input.doctorId && appointment.doctorId !== input.doctorId) return false;
    if (input.status && appointment.status !== input.status) return false;
    return true;
  }

  private didScheduleChange(
    previousScheduledAt: Date,
    previousDoctorId: string,
    previousDuration: number,
    saved: Appointment,
  ): boolean {
    const timeChanged =
      Math.abs(saved.scheduledAt.getTime() - previousScheduledAt.getTime()) >= 60_000;
    return (
      timeChanged ||
      saved.doctorId !== previousDoctorId ||
      saved.durationMinutes !== previousDuration
    );
  }

  private toEventPayload(
    appointment: Appointment,
    extras: {
      changeKind?: 'RESCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'STATUS';
      previousStatus?: string;
      previousScheduledAt?: string;
      previousDoctorId?: string;
    } = {},
  ) {
    const payload: Record<string, unknown> = {
      appointmentId: appointment.id,
      tenantId: appointment.tenantId,
      clinicId: appointment.tenantId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      guestPatientName: appointment.guestPatientName,
      guestPatientPhone: appointment.guestPatientPhone,
      scheduledAt: appointment.scheduledAt.toISOString(),
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
    };
    if (extras.changeKind) payload.changeKind = extras.changeKind;
    if (extras.previousStatus) payload.previousStatus = extras.previousStatus;
    if (extras.previousScheduledAt) payload.previousScheduledAt = extras.previousScheduledAt;
    if (extras.previousDoctorId) payload.previousDoctorId = extras.previousDoctorId;
    return payload;
  }
}
