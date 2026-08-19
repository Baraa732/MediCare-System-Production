import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { PushDeviceToken } from '../entities/push-device-token.entity';
import {
  StaffInboxNotification,
  StaffNotificationCategory,
} from '../entities/staff-inbox-notification.entity';
import { FirebasePushService } from './firebase-push.service';
import { ClinicHttpClient } from './clinic-http.client';
import { AppointmentEventPayload } from './notification.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import type { NotifySystemManagersDto } from '../dto/notification.dto';

@Injectable()
export class StaffPushService {
  private readonly logger = new Logger(StaffPushService.name);

  constructor(
    @InjectRepository(PushDeviceToken)
    private readonly tokenRepo: Repository<PushDeviceToken>,
    @InjectRepository(StaffInboxNotification)
    private readonly inboxRepo: Repository<StaffInboxNotification>,
    private readonly firebasePush: FirebasePushService,
    private readonly clinicHttpClient: ClinicHttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  async registerDevice(
    userId: string,
    fcmToken: string,
    platform = 'web',
    deviceLabel?: string,
  ): Promise<void> {
    const tenantId = this.tenantContext.getTenantId() ?? undefined;
    const where: Record<string, unknown> = { userId, fcmToken };
    if (tenantId) where.tenantId = tenantId;

    const existing = await this.tokenRepo.findOne({ where: where as never });
    if (existing) {
      existing.enabled = true;
      existing.platform = platform;
      existing.deviceLabel = deviceLabel ?? existing.deviceLabel;
      existing.lastSeenAt = new Date();
      if (tenantId) existing.tenantId = tenantId;
      await this.tokenRepo.save(existing);
      return;
    }

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        tenantId: tenantId ?? null,
        fcmToken,
        platform,
        deviceLabel,
        enabled: true,
      }),
    );
  }

  async unregisterDevice(userId: string, fcmToken: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { userId, fcmToken };
    if (tenantId) where.tenantId = tenantId;
    await this.tokenRepo.delete(where as never);
  }

  async listInbox(
    userId: string,
    options: { page: number; limit: number; unreadOnly?: boolean },
  ) {
    const skip = (options.page - 1) * options.limit;
    const qb = this.inboxRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC');

    if (options.unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }

    const ctxTenant = this.tenantContext.getTenantId();
    if (ctxTenant) {
      qb.andWhere('n.tenant_id = :ctxTenantId', { ctxTenantId: ctxTenant });
    }

    const [items, total] = await qb.skip(skip).take(options.limit).getManyAndCount();
    const unreadWhere: Record<string, unknown> = { userId, readAt: IsNull() };
    if (ctxTenant) unreadWhere.tenantId = ctxTenant;
    const unreadCount = await this.inboxRepo.count({
      where: unreadWhere as never,
    });

    return { items, page: options.page, limit: options.limit, total, unreadCount };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const ctxTenant = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { id: notificationId, userId };
    if (ctxTenant) where.tenantId = ctxTenant;
    const result = await this.inboxRepo.update(where as never, { readAt: new Date() });
    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const ctxTenant = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { userId, readAt: IsNull() };
    if (ctxTenant) where.tenantId = ctxTenant;
    await this.inboxRepo.update(where as never, { readAt: new Date() });
  }

  async notifySystemManagers(dto: NotifySystemManagersDto): Promise<{ delivered: number; skipped: number }> {
    const uniqueIds = Array.from(new Set(dto.userIds));
    let delivered = 0;
    let skipped = 0;
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

    for (const userId of uniqueIds) {
      if (dto.dedupeKey) {
        const existing = await this.inboxRepo
          .createQueryBuilder('n')
          .where('n.userId = :userId', { userId })
          .andWhere("n.data->>'dedupeKey' = :dedupeKey", { dedupeKey: dto.dedupeKey })
          .andWhere('n.createdAt > :since', { since })
          .getOne();
        if (existing) {
          skipped += 1;
          continue;
        }
      }

      await this.deliverToUser(userId, {
        category: StaffNotificationCategory.SYSTEM,
        title: dto.title,
        body: dto.body,
        clinicId: dto.clinicId,
        requireTenant: false,
        data: {
          kind: dto.kind ?? 'SYSTEM',
          severity: dto.severity ?? 'warning',
          deepLink: dto.deepLink ?? '/',
          dedupeKey: dto.dedupeKey ?? null,
          clinicId: dto.clinicId ?? null,
          category: StaffNotificationCategory.SYSTEM,
        },
      });
      delivered += 1;
    }

    return { delivered, skipped };
  }

  async notifyClinicSecretaries(
    payload: AppointmentEventPayload,
    category: StaffNotificationCategory,
  ): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    const secretaries = await this.clinicHttpClient.listSecretaries(tenantId);
    if (!secretaries.length) {
      this.logger.debug(`No secretaries for clinic ${tenantId}`);
      return;
    }

    const clinic = await this.clinicHttpClient.getClinicById(tenantId);
    const clinicName = clinic?.name ?? 'your clinic';
    const scheduled = new Date(payload.scheduledAt);
    const when = scheduled.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const { title, body } = this.buildCopy(category, clinicName, when, payload.status);

    for (const secretary of secretaries) {
      await this.deliverToUser(secretary.userId, {
        category,
        title,
        body,
        appointmentId: payload.appointmentId,
        clinicId: tenantId,
        data: {
          appointmentId: payload.appointmentId,
          clinicId: tenantId,
          tenantId,
          doctorId: payload.doctorId,
          patientId: payload.patientId,
          scheduledAt: payload.scheduledAt,
          status: payload.status,
          category,
          deepLink: '/dashboard',
        },
      });
    }
  }

  async notifyDoctorAppointment(
    payload: AppointmentEventPayload,
    category: StaffNotificationCategory,
  ): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    const clinic = await this.clinicHttpClient.getClinicById(tenantId);
    const clinicName = clinic?.name ?? 'your clinic';
    const scheduled = new Date(payload.scheduledAt);
    const when = scheduled.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const copy = this.doctorCopy(category, clinicName, when, payload.status);
    await this.deliverToUser(payload.doctorId, {
      category,
      title: copy.title,
      body: copy.body,
      appointmentId: payload.appointmentId,
      clinicId: tenantId,
      data: {
        appointmentId: payload.appointmentId,
        clinicId: tenantId,
        tenantId,
        doctorId: payload.doctorId,
        patientId: payload.patientId,
        scheduledAt: payload.scheduledAt,
        status: payload.status,
        category,
        deepLink: '/schedule',
      },
    });
  }

  async broadcastDoctorSystemMessage(
    userIds: string[],
    title: string,
    body: string,
  ): Promise<{
    recipients: number;
    inboxSaved: number;
    pushSuccess: number;
    pushFailed: number;
  }> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    let inboxSaved = 0;
    let pushSuccess = 0;
    let pushFailed = 0;

    const concurrency = 25;
    for (let i = 0; i < uniqueIds.length; i += concurrency) {
      const chunk = uniqueIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map((userId) =>
          this.deliverToUser(userId, {
            category: StaffNotificationCategory.SYSTEM,
            title,
            body,
            requireTenant: false,
            data: {
              category: StaffNotificationCategory.SYSTEM,
              deepLink: '/notifications',
              source: 'platform_doctor_broadcast',
              audience: 'doctor',
            },
          }),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          inboxSaved += 1;
          pushSuccess += result.value.pushSuccess ?? 0;
          pushFailed += result.value.pushFailed ?? 0;
        } else {
          this.logger.warn(`Doctor broadcast deliver failed: ${result.reason}`);
        }
      }
    }

    this.logger.log(
      `Platform broadcast to ${uniqueIds.length} doctors: inbox=${inboxSaved}, pushOk=${pushSuccess}, pushFail=${pushFailed}`,
    );

    return {
      recipients: uniqueIds.length,
      inboxSaved,
      pushSuccess,
      pushFailed,
    };
  }

  private buildCopy(
    category: StaffNotificationCategory,
    clinicName: string,
    when: string,
    status: string,
  ): { title: string; body: string } {
    switch (category) {
      case StaffNotificationCategory.APPOINTMENT_CANCELLED:
        return {
          title: 'Appointment cancelled',
          body: `A booking at ${clinicName} on ${when} was cancelled.`,
        };
      case StaffNotificationCategory.APPOINTMENT_UPDATED:
        return {
          title: 'Appointment rescheduled',
          body: `A booking at ${clinicName} was moved to ${when}.`,
        };
      case StaffNotificationCategory.APPOINTMENT_REQUESTED:
        return {
          title: 'New appointment request',
          body: `A patient requested an appointment at ${clinicName} for ${when}. Review it in pending requests.`,
        };
      case StaffNotificationCategory.APPOINTMENT_CREATED:
      default:
        if (status === 'REQUESTED') {
          return {
            title: 'New appointment request',
            body: `A patient requested an appointment at ${clinicName} for ${when}.`,
          };
        }
        return {
          title: 'New appointment booked',
          body: `A new appointment was booked at ${clinicName} for ${when}.`,
        };
    }
  }

  private doctorCopy(
    category: StaffNotificationCategory,
    clinicName: string,
    when: string,
    status: string,
  ): { title: string; body: string } {
    switch (category) {
      case StaffNotificationCategory.APPOINTMENT_CANCELLED:
        return {
          title: 'Appointment cancelled',
          body: `A visit on ${when} at ${clinicName} was cancelled.`,
        };
      case StaffNotificationCategory.APPOINTMENT_UPDATED:
        return {
          title: 'Appointment updated',
          body: `A visit at ${clinicName} was moved to ${when}.`,
        };
      case StaffNotificationCategory.APPOINTMENT_REQUESTED:
        return {
          title: 'New appointment request',
          body: `A patient requested a new visit at ${clinicName} for ${when}.`,
        };
      case StaffNotificationCategory.APPOINTMENT_CREATED:
        if (status === 'REQUESTED') {
          return {
            title: 'New appointment request',
            body: `A patient requested a new visit at ${clinicName} for ${when}.`,
          };
        }
        return {
          title: 'New appointment booked',
          body: `You have a new appointment at ${clinicName} on ${when}.`,
        };
      case StaffNotificationCategory.SYSTEM:
        return {
          title: 'System update',
          body: `MediCare sent an update for doctors at ${clinicName}.`,
        };
    }
  }

  private async deliverToUser(
    userId: string,
    input: {
      category: StaffNotificationCategory;
      title: string;
      body: string;
      appointmentId?: string;
      clinicId?: string;
      requireTenant?: boolean;
      data: Record<string, unknown>;
    },
  ): Promise<{ pushSuccess: number; pushFailed: number }> {
    let tenantId =
      input.clinicId ??
      (input.data.tenantId as string | undefined) ??
      (input.data.clinicId as string | undefined) ??
      this.tenantContext.getTenantId() ??
      undefined;

    if (!tenantId && input.requireTenant === false) {
      const existingToken = await this.tokenRepo.findOne({
        where: { userId, enabled: true },
        order: { lastSeenAt: 'DESC', createdAt: 'DESC' },
      });
      tenantId = existingToken?.tenantId ?? undefined;
    }

    if (input.requireTenant !== false && !tenantId) {
      this.logger.warn(`Skipping staff inbox notification — missing tenantId for user ${userId}`);
      return { pushSuccess: 0, pushFailed: 0 };
    }

    const inbox = await this.inboxRepo.save(
      this.inboxRepo.create({
        userId,
        tenantId: tenantId ?? null,
        category: input.category,
        title: input.title,
        body: input.body,
        appointmentId: input.appointmentId,
        data: input.data,
      }),
    );

    const tokens = await this.tokenRepo.find({
      where: { userId, enabled: true },
    });

    if (!tokens.length) return { pushSuccess: 0, pushFailed: 0 };

    const stringData: Record<string, string> = {
      notificationId: inbox.id,
      category: input.category,
      title: input.title,
      body: input.body,
      deepLink: String(input.data.deepLink ?? '/dashboard'),
    };

    for (const [key, value] of Object.entries(input.data)) {
      if (value !== undefined && value !== null) {
        stringData[key] = String(value);
      }
    }

    const result = await this.firebasePush.sendToTokens(
      tokens.map((t) => t.fcmToken),
      {
        title: input.title,
        body: input.body,
        data: stringData,
      },
    );

    if (result.invalidTokens.length) {
      await this.tokenRepo.delete({
        fcmToken: In(result.invalidTokens),
      });
    }

    this.logger.log(
      `Push to user ${userId}: ${result.successCount} ok, ${result.failureCount} failed`,
    );
    return { pushSuccess: result.successCount, pushFailed: result.failureCount };
  }
}
