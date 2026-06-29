import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { ClinicHours } from '../entities/clinic-hours.entity';
import { DoctorAvailability } from '../entities/doctor-availability.entity';
import { ScheduleBlock } from '../entities/schedule-block.entity';
import {
  SetClinicHoursDto,
  CreateAvailabilityDto,
  CreateBlockDto,
  SlotsQueryDto,
  ValidateSlotDto,
} from '../dto/schedule.dto';
import { ClinicHttpClient } from './clinic-http.client';
import { AppointmentHttpClient, BookedRange } from './appointment-http.client';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';

export interface AuthUser {
  userId: string;
  role: string;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ClinicHours) private readonly hoursRepo: Repository<ClinicHours>,
    @InjectRepository(DoctorAvailability) private readonly availabilityRepo: Repository<DoctorAvailability>,
    @InjectRepository(ScheduleBlock) private readonly blockRepo: Repository<ScheduleBlock>,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientProxy,
    private readonly clinicHttp: ClinicHttpClient,
    private readonly appointmentHttp: AppointmentHttpClient,
  ) {}

  async setClinicHours(clinicId: string, dto: SetClinicHoursDto, actor: AuthUser) {
    const tenantId = clinicId;
    await this.assertCanManageClinic(clinicId, actor);
    let row = await this.hoursRepo.findOne({ where: { tenantId, dayOfWeek: dto.dayOfWeek } });
    if (!row) {
      row = this.hoursRepo.create({ tenantId, dayOfWeek: dto.dayOfWeek });
    }
    if (dto.openTime) row.openTime = dto.openTime;
    if (dto.closeTime) row.closeTime = dto.closeTime;
    if (dto.isClosed !== undefined) row.isClosed = dto.isClosed;
    const saved = await this.hoursRepo.save(row);
    this.emitScheduleUpdated(clinicId, 'clinic_hours');
    return saved;
  }

  async getClinicHours(clinicId: string) {
    const tenantId = clinicId;
    const hours = await this.hoursRepo.find({ where: { tenantId }, order: { dayOfWeek: 'ASC' } });
    if (hours.length > 0) return hours;

    const seeded = await this.seedDefaultClinicHours(clinicId);
    this.emitScheduleUpdated(clinicId, 'clinic_hours');
    return seeded;
  }

  async createAvailability(dto: CreateAvailabilityDto, actor: AuthUser) {
    await this.assertCanManageClinic(dto.clinicId, actor);
    const assigned = await this.clinicHttp.verifyDoctorAtClinic(dto.clinicId, dto.doctorId);
    if (!assigned) throw new BadRequestException('Doctor is not assigned to this clinic');

    if (this.toMinutes(dto.startTime) >= this.toMinutes(dto.endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const row = this.availabilityRepo.create({
      tenantId: dto.clinicId,
      doctorId: dto.doctorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      slotDurationMinutes: dto.slotDurationMinutes ?? 30,
    });
    const saved = await this.availabilityRepo.save(row);
    this.emitScheduleUpdated(dto.clinicId, 'doctor_availability', dto.doctorId);
    return saved;
  }

  async listAvailability(clinicId: string, doctorId?: string) {
    const tenantId = clinicId;
    const where: Record<string, string> = { tenantId };
    if (doctorId) where.doctorId = doctorId;
    return this.availabilityRepo.find({ where, order: { dayOfWeek: 'ASC', startTime: 'ASC' } });
  }

  async createBlock(dto: CreateBlockDto, actor: AuthUser) {
    await this.assertCanManageClinic(dto.clinicId, actor);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('endsAt must be after startsAt');

    const saved = await this.blockRepo.save(
      this.blockRepo.create({
        tenantId: dto.clinicId,
        doctorId: dto.doctorId,
        startsAt,
        endsAt,
        reason: dto.reason,
        createdBy: actor.userId,
      }),
    );
    this.emitScheduleUpdated(dto.clinicId, 'block', dto.doctorId);
    return saved;
  }

  async getSlots(query: SlotsQueryDto) {
    const duration = query.durationMinutes ?? 30;
    const timezone = await this.clinicHttp.getClinicTimezone(query.clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const dayOfWeek = this.dayOfWeekFromDate(query.date, offsetMinutes);
    const bookedRanges = await this.appointmentHttp.getBookedRanges(
      query.clinicId,
      query.doctorId,
      query.date,
    );
    const slots = await this.buildSlotsForDay(
      query.clinicId,
      query.doctorId,
      query.date,
      dayOfWeek,
      duration,
      offsetMinutes,
      bookedRanges,
    );
    return { slots, timezone };
  }

  async validateSlot(dto: ValidateSlotDto): Promise<{ valid: boolean; reason?: string }> {
    const scheduledAt = new Date(dto.scheduledAt);
    const duration = dto.durationMinutes ?? 30;
    const date = dto.scheduledAt.slice(0, 10);
    const timezone = await this.clinicHttp.getClinicTimezone(dto.clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const dayOfWeek = this.dayOfWeekFromDate(date, offsetMinutes);

    const assigned = await this.clinicHttp.verifyDoctorAtClinic(dto.clinicId, dto.doctorId);
    if (!assigned) return { valid: false, reason: 'DOCTOR_NOT_AT_CLINIC' };

    const bookedRanges = await this.appointmentHttp.getBookedRanges(dto.clinicId, dto.doctorId, date);
    const slots = await this.buildSlotsForDay(
      dto.clinicId,
      dto.doctorId,
      date,
      dayOfWeek,
      duration,
      offsetMinutes,
      bookedRanges,
    );
    const iso = scheduledAt.toISOString();
    const match = slots.some((s) => s === iso);
    if (!match) return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };

    return { valid: true };
  }

  private async buildSlotsForDay(
    clinicId: string,
    doctorId: string,
    date: string,
    dayOfWeek: number,
    durationMinutes: number,
    offsetMinutes: number,
    bookedRanges: BookedRange[] = [],
  ): Promise<string[]> {
    const tenantId = clinicId;
    const clinicDay = await this.hoursRepo.findOne({ where: { tenantId, dayOfWeek } });
    if (clinicDay?.isClosed) return [];

    const clinicOpen = clinicDay ? this.toMinutes(clinicDay.openTime) : 9 * 60;
    const clinicClose = clinicDay ? this.toMinutes(clinicDay.closeTime) : 17 * 60;

    const windows = await this.availabilityRepo.find({
      where: { tenantId, doctorId, dayOfWeek },
    });
    let dayWindows = windows;
    if (dayWindows.length === 0) {
      await this.seedDefaultAvailabilityIfAssigned(clinicId, doctorId);
      dayWindows = await this.availabilityRepo.find({
        where: { tenantId, doctorId, dayOfWeek },
      });
    }
    if (dayWindows.length === 0) return [];

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const blocks = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('(b.doctorId = :doctorId OR b.doctorId IS NULL)', { doctorId })
      .andWhere('b.startsAt < :dayEnd AND b.endsAt > :dayStart', { dayStart, dayEnd })
      .getMany();

    const now = Date.now();
    const slots: string[] = [];

    for (const window of dayWindows) {
      const winStart = Math.max(this.toMinutes(window.startTime), clinicOpen);
      const winEnd = Math.min(this.toMinutes(window.endTime), clinicClose);
      const step = window.slotDurationMinutes || durationMinutes;

      for (let m = winStart; m + durationMinutes <= winEnd; m += step) {
        const startIso = this.localMinutesToIso(date, m, offsetMinutes);
        const endIso = this.localMinutesToIso(date, m + durationMinutes, offsetMinutes);
        const startMs = new Date(startIso).getTime();
        const endMs = new Date(endIso).getTime();

        if (startMs <= now) continue;
        if (blocks.some((b) => startMs < b.endsAt.getTime() && endMs > b.startsAt.getTime())) continue;
        if (bookedRanges.some((r) => startMs < new Date(r.end).getTime() && endMs > new Date(r.start).getTime())) {
          continue;
        }

        slots.push(startIso);
      }
    }

    return [...new Set(slots)].sort();
  }

  private async seedDefaultClinicHours(clinicId: string): Promise<ClinicHours[]> {
    const tenantId = clinicId;
    const defaults = Array.from({ length: 7 }, (_, dayOfWeek) =>
      this.hoursRepo.create({
        tenantId,
        dayOfWeek,
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
      }),
    );
    return this.hoursRepo.save(defaults);
  }

  private async seedDefaultAvailabilityIfAssigned(clinicId: string, doctorId: string): Promise<void> {
    const tenantId = clinicId;
    const assigned = await this.clinicHttp.verifyDoctorAtClinic(clinicId, doctorId);
    if (!assigned) return;

    const existing = await this.availabilityRepo.count({ where: { tenantId, doctorId } });
    if (existing > 0) return;

    const defaults = Array.from({ length: 7 }, (_, dayOfWeek) =>
      this.availabilityRepo.create({
        tenantId,
        doctorId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
      }),
    );
    await this.availabilityRepo.save(defaults);
    this.emitScheduleUpdated(clinicId, 'doctor_availability', doctorId);
  }

  private async assertCanManageClinic(clinicId: string, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (['CLINIC_ADMIN', 'SECRETARY'].includes(actor.role)) {
      const ok = await this.clinicHttp.checkClinicAccess(clinicId, actor.userId);
      if (ok) return;
    }
    throw new ForbiddenException('You cannot manage schedule for this clinic');
  }

  private emitScheduleUpdated(clinicId: string, kind: string, doctorId?: string) {
    this.kafkaClient.emit(
      KafkaTopics.SCHEDULE_UPDATED,
      withTenantEvent(clinicId, {
        tenantId: clinicId,
        clinicId,
        doctorId,
        kind,
      }),
    );
  }

  private dayOfWeekFromDate(date: string, offsetMinutes = 0): number {
    const [y, mo, d] = date.split('-').map(Number);
    const utc = Date.UTC(y, mo - 1, d, 12, 0, 0) - offsetMinutes * 60_000;
    return new Date(utc).getUTCDay();
  }

  private timezoneOffsetMinutes(timezone: string): number {
    const map: Record<string, number> = {
      'Asia/Damascus': 180,
      UTC: 0,
    };
    return map[timezone] ?? 180;
  }

  private localMinutesToIso(date: string, minutes: number, offsetMinutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const [y, mo, d] = date.split('-').map(Number);
    const utcMs = Date.UTC(y, mo - 1, d, h, m, 0) - offsetMinutes * 60_000;
    return new Date(utcMs).toISOString();
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
}
