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
  CloseClinicDayDto,
  SlotsQueryDto,
  ValidateSlotDto,
} from '../dto/schedule.dto';
import { ClinicHttpClient } from './clinic-http.client';
import { AppointmentHttpClient, BookedRange } from './appointment-http.client';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

export interface AuthUser {
  userId: string;
  role: string;
  tenantId?: string;
  clinicId?: string;
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
    private readonly tenantContext: TenantContextService,
  ) {}

  async setClinicHours(clinicId: string, dto: SetClinicHoursDto, actor: AuthUser) {
    const tenantId = clinicId;
    await this.assertCanManageClinic(clinicId, actor);
    let row = await this.hoursRepo.findOne({ where: { tenantId, dayOfWeek: dto.dayOfWeek } });
    const wasClosed = row?.isClosed === true;
    if (!row) {
      row = this.hoursRepo.create({ tenantId, dayOfWeek: dto.dayOfWeek });
    }
    if (dto.openTime) row.openTime = dto.openTime;
    if (dto.closeTime) row.closeTime = dto.closeTime;
    if (dto.isClosed !== undefined) row.isClosed = dto.isClosed;
    const saved = await this.hoursRepo.save(row);
    this.emitScheduleUpdated(clinicId, 'clinic_hours');

    let cancelledCount = 0;
    if (saved.isClosed && !wasClosed) {
      cancelledCount = await this.cancelUpcomingWeekdayClosures(
        clinicId,
        saved.dayOfWeek,
        actor.userId,
        `Clinic closed on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][saved.dayOfWeek]}s`,
      );
    } else if (!saved.isClosed && wasClosed) {
      // Re-open weekday: remove auto full-day blocks so bookings work again.
      await this.removeUpcomingWeekdayClosures(clinicId, saved.dayOfWeek);
    }

    return { hours: saved, cancelledCount };
  }

  async getClinicHours(clinicId: string, actor: AuthUser) {
    await this.assertCanViewClinicSchedule(clinicId, actor);
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

  async listAvailability(clinicId: string, doctorId: string | undefined, actor: AuthUser) {
    clinicId = this.resolveStaffClinic(clinicId, actor);
    await this.assertCanViewClinicSchedule(clinicId, actor);
    if (actor.role === 'DOCTOR') {
      if (doctorId && doctorId !== actor.userId) {
        throw new ForbiddenException('You can only view your own availability');
      }
      doctorId = actor.userId;
    }
    const tenantId = clinicId;
    const where: Record<string, string> = { tenantId };
    if (doctorId) where.doctorId = doctorId;
    return this.availabilityRepo.find({ where, order: { dayOfWeek: 'ASC', startTime: 'ASC' } });
  }

  async createBlock(dto: CreateBlockDto, actor: AuthUser) {
    dto.clinicId = this.resolveStaffClinic(dto.clinicId, actor);
    if (actor.role === 'DOCTOR') {
      const ok = await this.clinicHttp.checkClinicAccess(dto.clinicId, actor.userId, actor.role);
      if (!ok) {
        throw new ForbiddenException('You do not have access to this clinic');
      }
      // Doctors may only block their own calendar (leave / personal unavailability).
      dto.doctorId = actor.userId;
    } else {
      await this.assertCanManageClinic(dto.clinicId, actor);
    }
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

    const reason = dto.reason?.trim()
      ? `Clinic closed: ${dto.reason.trim()}`
      : 'Clinic closed / time blocked';
    const cancelledCount = await this.appointmentHttp.cancelInRange({
      clinicId: dto.clinicId,
      fromIso: startsAt.toISOString(),
      toIso: endsAt.toISOString(),
      doctorId: dto.doctorId ?? null,
      reason,
      actorUserId: actor.userId,
    });

    return { block: saved, cancelledCount };
  }

  /** Full-day clinic-wide closure for a local calendar date (YYYY-MM-DD). */
  async closeClinicDay(clinicId: string, dto: CloseClinicDayDto, actor: AuthUser) {
    await this.assertCanManageClinic(clinicId, actor);
    const timezone = await this.clinicHttp.getClinicTimezone(clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const startsAt = new Date(this.localMinutesToIso(dto.date, 0, offsetMinutes));
    const endsAt = new Date(this.localMinutesToIso(dto.date, 24 * 60, offsetMinutes));
    const reason = dto.reason?.trim() || 'Clinic closed for the day';

    return this.createBlock(
      {
        clinicId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason,
      },
      actor,
    );
  }

  /** Remove full-day clinic-wide block(s) for a local calendar date so bookings reopen. */
  async openClinicDay(clinicId: string, dto: CloseClinicDayDto, actor: AuthUser) {
    await this.assertCanManageClinic(clinicId, actor);
    const timezone = await this.clinicHttp.getClinicTimezone(clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const startsAt = new Date(this.localMinutesToIso(dto.date, 0, offsetMinutes));
    const endsAt = new Date(this.localMinutesToIso(dto.date, 24 * 60, offsetMinutes));

    const blocks = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.tenantId = :tenantId', { tenantId: clinicId })
      .andWhere('b.doctorId IS NULL')
      .andWhere('b.startsAt = :startsAt', { startsAt })
      .andWhere('b.endsAt = :endsAt', { endsAt })
      .getMany();

    if (blocks.length > 0) {
      await this.blockRepo.remove(blocks);
      this.emitScheduleUpdated(clinicId, 'block');
    }
    return { removed: blocks.length };
  }

  async listBlocks(clinicId: string | undefined, doctorId: string | undefined, actor: AuthUser) {
    const tenantId = this.resolveStaffClinic(clinicId, actor);
    await this.assertCanViewClinicSchedule(tenantId, actor);
    if (actor.role === 'DOCTOR') {
      doctorId = actor.userId;
    }
    const where: Record<string, string> = { tenantId };
    if (doctorId) where.doctorId = doctorId;
    return this.blockRepo.find({
      where,
      order: { startsAt: 'DESC' },
    });
  }

  async listMyBlocks(actor: AuthUser) {
    return this.listBlocks(undefined, undefined, actor);
  }

  async getSlots(query: SlotsQueryDto) {
    const duration = query.durationMinutes ?? 30;
    const timezone = await this.clinicHttp.getClinicTimezone(query.clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const dayOfWeek = this.dayOfWeekFromDate(query.date, offsetMinutes);
    const assigned = await this.clinicHttp.verifyDoctorAtClinic(query.clinicId, query.doctorId);
    if (!assigned) return { slots: [], timezone, closed: false };

    const tenantId = query.clinicId;
    const clinicDay = await this.hoursRepo.findOne({ where: { tenantId, dayOfWeek } });
    if (clinicDay?.isClosed) {
      return { slots: [], timezone, closed: true };
    }

    if (await this.hasFullDayClinicBlock(query.clinicId, query.date, offsetMinutes)) {
      return { slots: [], timezone, closed: true };
    }

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
    return { slots, timezone, closed: false };
  }

  async validateSlot(dto: ValidateSlotDto): Promise<{ valid: boolean; reason?: string }> {
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };
    }
    const duration = dto.durationMinutes ?? 30;
    const startMs = scheduledAt.getTime();
    const endMs = startMs + duration * 60_000;
    if (startMs <= Date.now() - 15_000) {
      return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };
    }

    const assigned = await this.clinicHttp.verifyDoctorAtClinic(dto.clinicId, dto.doctorId);
    if (!assigned) return { valid: false, reason: 'DOCTOR_NOT_AT_CLINIC' };

    const timezone = await this.clinicHttp.getClinicTimezone(dto.clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const date = this.localDateKey(scheduledAt, offsetMinutes);
    const dayOfWeek = this.dayOfWeekFromDate(date, offsetMinutes);

    const clinicDay = await this.hoursRepo.findOne({
      where: { tenantId: dto.clinicId, dayOfWeek },
    });
    if (clinicDay?.isClosed) return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };

    const bookedRanges = await this.appointmentHttp.getBookedRanges(
      dto.clinicId,
      dto.doctorId,
      date,
      dto.excludeAppointmentId,
    );

    if (dto.strictHours) {
      const slots = await this.buildSlotsForDay(
        dto.clinicId,
        dto.doctorId,
        date,
        dayOfWeek,
        duration,
        offsetMinutes,
        bookedRanges,
      );
      const match = slots.some((s) => Math.abs(new Date(s).getTime() - startMs) < 60_000);
      if (!match) return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };
      return { valid: true };
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const blocks = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.tenantId = :tenantId', { tenantId: dto.clinicId })
      .andWhere('(b.doctorId = :doctorId OR b.doctorId IS NULL)', { doctorId: dto.doctorId })
      .andWhere('b.startsAt < :dayEnd AND b.endsAt > :dayStart', { dayStart, dayEnd })
      .getMany();

    if (blocks.some((b) => startMs < b.endsAt.getTime() && endMs > b.startsAt.getTime())) {
      return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };
    }
    if (
      bookedRanges.some(
        (r) => startMs < new Date(r.end).getTime() && endMs > new Date(r.start).getTime(),
      )
    ) {
      return { valid: false, reason: 'SLOT_NOT_AVAILABLE' };
    }

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
    if (!Number.isFinite(clinicOpen) || !Number.isFinite(clinicClose) || clinicOpen >= clinicClose) {
      return [];
    }

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
    // Clinic is open this weekday and the doctor is assigned: use clinic hours
    // even when this weekday was never saved on doctor_availability.
    if (dayWindows.length === 0) {
      dayWindows = [
        this.availabilityRepo.create({
          tenantId,
          doctorId,
          dayOfWeek,
          startTime: this.fromMinutes(clinicOpen),
          endTime: this.fromMinutes(clinicClose),
          slotDurationMinutes: durationMinutes,
        }),
      ];
    }

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
      const step = Math.min(window.slotDurationMinutes || durationMinutes, 15);

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

    const existing = await this.availabilityRepo.find({ where: { tenantId, doctorId } });
    const haveDays = new Set(existing.map((row) => row.dayOfWeek));
    const missingDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !haveDays.has(day));
    if (missingDays.length === 0) return;

    const hours = await this.hoursRepo.find({ where: { tenantId } });
    const hoursByDay = new Map(hours.map((row) => [row.dayOfWeek, row]));
    const defaults = missingDays
      .filter((dayOfWeek) => hoursByDay.get(dayOfWeek)?.isClosed !== true)
      .map((dayOfWeek) => {
        const clinicDay = hoursByDay.get(dayOfWeek);
        return this.availabilityRepo.create({
          tenantId,
          doctorId,
          dayOfWeek,
          startTime: clinicDay?.openTime ?? '09:00',
          endTime: clinicDay?.closeTime ?? '17:00',
          slotDurationMinutes: 30,
        });
      });
    if (defaults.length === 0) return;
    await this.availabilityRepo.save(defaults);
    this.emitScheduleUpdated(clinicId, 'doctor_availability', doctorId);
  }

  private resolveStaffClinic(requestedClinicId: string | undefined, actor: AuthUser): string {
    const homeClinic =
      actor.clinicId || actor.tenantId || this.tenantContext.getTenantId() || undefined;
    if (actor.role === 'SYSTEM_MANAGER') {
      const clinicId = requestedClinicId || homeClinic;
      if (!clinicId) throw new BadRequestException('clinicId is required');
      return clinicId;
    }
    const clinicId = requestedClinicId || homeClinic;
    if (!clinicId) {
      throw new BadRequestException('Missing clinic context for this staff account');
    }
    if (homeClinic && requestedClinicId && requestedClinicId !== homeClinic) {
      throw new ForbiddenException('You can only access the clinic you belong to');
    }
    return clinicId;
  }

  private async assertCanViewClinicSchedule(clinicId: string, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER' || actor.role === 'PATIENT') return;
    const ok = await this.clinicHttp.checkClinicAccess(clinicId, actor.userId, actor.role);
    if (!ok) {
      throw new ForbiddenException('You do not have access to this clinic schedule');
    }
  }

  private async assertCanManageClinic(clinicId: string, actor: AuthUser) {
    if (actor.role === 'SYSTEM_MANAGER') return;
    if (['CLINIC_ADMIN', 'SECRETARY'].includes(actor.role)) {
      const ok = await this.clinicHttp.checkClinicAccess(clinicId, actor.userId, actor.role);
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

  /** Cancel upcoming appointments on matching weekdays for the next 90 days. */
  private async cancelUpcomingWeekdayClosures(
    clinicId: string,
    dayOfWeek: number,
    actorUserId: string,
    reason: string,
  ): Promise<number> {
    const timezone = await this.clinicHttp.getClinicTimezone(clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const todayKey = this.localDateKey(new Date(), offsetMinutes);
    let total = 0;

    for (let i = 0; i < 90; i++) {
      const [y, mo, d] = todayKey.split('-').map(Number);
      const probeUtc = Date.UTC(y, mo - 1, d + i, 12, 0, 0) - offsetMinutes * 60_000;
      const dateKey = this.localDateKey(new Date(probeUtc), offsetMinutes);
      if (this.dayOfWeekFromDate(dateKey, offsetMinutes) !== dayOfWeek) continue;

      const fromIso = this.localMinutesToIso(dateKey, 0, offsetMinutes);
      const toIso = this.localMinutesToIso(dateKey, 24 * 60, offsetMinutes);

      // Persist a visible full-day clinic-wide block for each upcoming closed weekday.
      const startsAt = new Date(fromIso);
      const endsAt = new Date(toIso);
      const existing = await this.blockRepo
        .createQueryBuilder('b')
        .where('b.tenantId = :tenantId', { tenantId: clinicId })
        .andWhere('b.doctorId IS NULL')
        .andWhere('b.startsAt = :startsAt', { startsAt })
        .andWhere('b.endsAt = :endsAt', { endsAt })
        .getOne();
      if (!existing) {
        await this.blockRepo.save(
          this.blockRepo.create({
            tenantId: clinicId,
            doctorId: null,
            startsAt,
            endsAt,
            reason,
            createdBy: actorUserId,
          }),
        );
      }

      total += await this.appointmentHttp.cancelInRange({
        clinicId,
        fromIso,
        toIso,
        doctorId: null,
        reason,
        actorUserId,
      });
    }

    this.emitScheduleUpdated(clinicId, 'block');
    return total;
  }

  /** Undo weekday closures created by cancelUpcomingWeekdayClosures. */
  private async removeUpcomingWeekdayClosures(
    clinicId: string,
    dayOfWeek: number,
  ): Promise<number> {
    const timezone = await this.clinicHttp.getClinicTimezone(clinicId);
    const offsetMinutes = this.timezoneOffsetMinutes(timezone);
    const todayKey = this.localDateKey(new Date(), offsetMinutes);
    let removed = 0;

    for (let i = 0; i < 90; i++) {
      const [y, mo, d] = todayKey.split('-').map(Number);
      const probeUtc = Date.UTC(y, mo - 1, d + i, 12, 0, 0) - offsetMinutes * 60_000;
      const dateKey = this.localDateKey(new Date(probeUtc), offsetMinutes);
      if (this.dayOfWeekFromDate(dateKey, offsetMinutes) !== dayOfWeek) continue;

      const startsAt = new Date(this.localMinutesToIso(dateKey, 0, offsetMinutes));
      const endsAt = new Date(this.localMinutesToIso(dateKey, 24 * 60, offsetMinutes));

      const blocks = await this.blockRepo
        .createQueryBuilder('b')
        .where('b.tenantId = :tenantId', { tenantId: clinicId })
        .andWhere('b.doctorId IS NULL')
        .andWhere('b.startsAt = :startsAt', { startsAt })
        .andWhere('b.endsAt = :endsAt', { endsAt })
        .getMany();
      if (blocks.length > 0) {
        await this.blockRepo.remove(blocks);
        removed += blocks.length;
      }
    }

    if (removed > 0) {
      this.emitScheduleUpdated(clinicId, 'block');
    }
    return removed;
  }

  private async hasFullDayClinicBlock(
    clinicId: string,
    dateKey: string,
    offsetMinutes: number,
  ): Promise<boolean> {
    const dayStart = new Date(this.localMinutesToIso(dateKey, 0, offsetMinutes));
    const dayEnd = new Date(this.localMinutesToIso(dateKey, 24 * 60, offsetMinutes));
    const block = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.tenantId = :tenantId', { tenantId: clinicId })
      .andWhere('b.doctorId IS NULL')
      .andWhere('b.startsAt <= :dayStart', { dayStart })
      .andWhere('b.endsAt >= :dayEnd', { dayEnd })
      .getOne();
    return Boolean(block);
  }

  private localDateKey(scheduledAt: Date, offsetMinutes: number): string {
    const local = new Date(scheduledAt.getTime() + offsetMinutes * 60_000);
    return local.toISOString().slice(0, 10);
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

  private fromMinutes(total: number): string {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
