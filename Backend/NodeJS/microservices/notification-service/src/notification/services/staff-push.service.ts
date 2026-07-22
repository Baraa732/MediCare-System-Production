import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    if (!ctxTenant) {
      throw new ForbiddenException('Tenant context is required');
    }
    const where: Record<string, unknown> = { id: notificationId, userId, tenantId: ctxTenant };
    const result = await this.inboxRepo.update(where as never, { readAt: new Date() });
    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const ctxTenant = this.tenantContext.getTenantId();
    if (!ctxTenant) {
      throw new ForbiddenException('Tenant context is required');
    }
    const where: Record<string, unknown> = { userId, readAt: IsNull(), tenantId: ctxTenant };
    await this.inboxRepo.update(where as never, { readAt: new Date() });
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

  private async deliverToUser(
    userId: string,
    input: {
      category: StaffNotificationCategory;
      title: string;
      body: string;
      appointmentId?: string;
      clinicId?: string;
      data: Record<string, unknown>;
    },
  ): Promise<void> {
    const tenantId =
      input.clinicId ??
      (input.data.tenantId as string | undefined) ??
      (input.data.clinicId as string | undefined) ??
      this.tenantContext.getTenantId() ??
      undefined;

    if (!tenantId) {
      this.logger.warn(`Skipping staff inbox notification — missing tenantId for user ${userId}`);
      return;
    }

    const inbox = await this.inboxRepo.save(
      this.inboxRepo.create({
        userId,
        tenantId,
        category: input.category,
        title: input.title,
        body: input.body,
        appointmentId: input.appointmentId,
        data: input.data,
      }),
    );

    const tokens = await this.tokenRepo.find({
      where: {
        userId,
        enabled: true,
        ...(this.tenantContext.getTenantId()
          ? { tenantId: this.tenantContext.getTenantId()! }
          : {}),
      },
    });

    if (!tokens.length) return;

    const stringData: Record<string, string> = {
      notificationId: inbox.id,
      category: input.category,
      title: input.title,
      body: input.body,
      deepLink: '/dashboard',
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
  }
}
