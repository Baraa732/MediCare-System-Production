import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { PushDeviceToken } from '../entities/push-device-token.entity';
import {
  PatientInboxNotification,
  PatientNotificationCategory,
} from '../entities/patient-inbox-notification.entity';
import { FirebasePushService } from './firebase-push.service';
import { ClinicHttpClient } from './clinic-http.client';
import { AppointmentEventPayload } from './notification.service';
import { NotificationType } from '../entities/notification-log.entity';
import { AppointmentReminderDto } from '../dto/notification.dto';

@Injectable()
export class PatientPushService {
  private readonly logger = new Logger(PatientPushService.name);

  constructor(
    @InjectRepository(PushDeviceToken)
    private readonly tokenRepo: Repository<PushDeviceToken>,
    @InjectRepository(PatientInboxNotification)
    private readonly inboxRepo: Repository<PatientInboxNotification>,
    private readonly firebasePush: FirebasePushService,
    private readonly clinicHttpClient: ClinicHttpClient,
  ) {}

  async registerDevice(
    userId: string,
    fcmToken: string,
    platform = 'android',
    deviceLabel?: string,
  ): Promise<void> {
    const existing = await this.tokenRepo.findOne({
      where: { userId, fcmToken, tenantId: IsNull() },
    });
    if (existing) {
      existing.enabled = true;
      existing.platform = platform;
      existing.deviceLabel = deviceLabel ?? existing.deviceLabel;
      existing.lastSeenAt = new Date();
      await this.tokenRepo.save(existing);
      return;
    }

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        tenantId: null,
        fcmToken,
        platform,
        deviceLabel,
        enabled: true,
      }),
    );
  }

  async unregisterDevice(userId: string, fcmToken: string): Promise<void> {
    await this.tokenRepo.delete({ userId, fcmToken, tenantId: IsNull() });
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

    const [items, total] = await qb.skip(skip).take(options.limit).getManyAndCount();
    const unreadCount = await this.inboxRepo.count({
      where: { userId, readAt: IsNull() },
    });

    return {
      items: items.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        type: row.category,
        appointmentId: row.appointmentId,
        clinicId: row.clinicId,
        readAt: row.readAt,
        createdAt: row.createdAt,
        data: row.data,
      })),
      page: options.page,
      limit: options.limit,
      total,
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const result = await this.inboxRepo.update(
      { id: notificationId, userId },
      { readAt: new Date() },
    );
    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.inboxRepo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async notifyFromAppointmentEvent(
    payload: AppointmentEventPayload,
    type: NotificationType,
  ): Promise<void> {
    if (!payload.patientId) {
      return;
    }
    const category = this.mapCategory(type, payload.status);
    const clinic = await this.clinicHttpClient.getClinicById(payload.clinicId);
    const clinicName = clinic?.name ?? 'your clinic';
    const scheduled = new Date(payload.scheduledAt);
    const when = scheduled.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const { title, body } = this.buildCopy(category, clinicName, when);

    await this.deliverToPatient(payload.patientId, {
      category,
      title,
      body,
      appointmentId: payload.appointmentId,
      clinicId: payload.clinicId,
      data: {
        appointmentId: payload.appointmentId,
        clinicId: payload.clinicId,
        doctorId: payload.doctorId,
        scheduledAt: payload.scheduledAt,
        status: payload.status,
        category,
        deepLink: `/appointments/${payload.appointmentId}`,
      },
    });
  }

  async notifyReminder(dto: AppointmentReminderDto): Promise<void> {
    const when = `${dto.appointmentDate} at ${dto.appointmentTime}`;
    await this.deliverToPatient(dto.patientId, {
      category: PatientNotificationCategory.APPOINTMENT_REMINDER,
      title: 'Appointment reminder',
      body: `Your visit with ${dto.doctorName} at ${dto.clinicName} is on ${when}.`,
      appointmentId: dto.appointmentId,
      clinicId: dto.tenantId,
      data: {
        appointmentId: dto.appointmentId,
        clinicId: dto.tenantId,
        category: PatientNotificationCategory.APPOINTMENT_REMINDER,
        deepLink: `/appointments/${dto.appointmentId}`,
      },
    });
  }

  /**
   * Platform broadcast: write SYSTEM inbox rows + FCM push for each patient.
   * Used by system-manager-service for manual all-patient announcements.
   */
  async broadcastSystemMessage(
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
          this.deliverToPatient(userId, {
            category: PatientNotificationCategory.SYSTEM,
            title,
            body,
            data: {
              category: PatientNotificationCategory.SYSTEM,
              deepLink: '/notifications',
              source: 'platform_broadcast',
            },
          }),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          inboxSaved += 1;
          pushSuccess += result.value.pushSuccess;
          pushFailed += result.value.pushFailed;
        } else {
          this.logger.warn(`Broadcast deliver failed: ${result.reason}`);
        }
      }
    }

    this.logger.log(
      `Platform broadcast to ${uniqueIds.length} patients: inbox=${inboxSaved}, pushOk=${pushSuccess}, pushFail=${pushFailed}`,
    );

    return {
      recipients: uniqueIds.length,
      inboxSaved,
      pushSuccess,
      pushFailed,
    };
  }

  private mapCategory(
    type: NotificationType,
    status: string,
  ): PatientNotificationCategory {
    switch (type) {
      case NotificationType.APPOINTMENT_CANCELLED:
        return PatientNotificationCategory.APPOINTMENT_CANCELLED;
      case NotificationType.APPOINTMENT_RESCHEDULED:
        return PatientNotificationCategory.APPOINTMENT_RESCHEDULED;
      case NotificationType.APPOINTMENT_REMINDER:
        return PatientNotificationCategory.APPOINTMENT_REMINDER;
      case NotificationType.APPOINTMENT_CONFIRMED:
      default:
        return status === 'REQUESTED'
          ? PatientNotificationCategory.SYSTEM
          : PatientNotificationCategory.APPOINTMENT_CONFIRMED;
    }
  }

  private buildCopy(
    category: PatientNotificationCategory,
    clinicName: string,
    when: string,
  ): { title: string; body: string } {
    switch (category) {
      case PatientNotificationCategory.APPOINTMENT_CANCELLED:
        return {
          title: 'Appointment cancelled',
          body: `Your appointment at ${clinicName} on ${when} was cancelled.`,
        };
      case PatientNotificationCategory.APPOINTMENT_RESCHEDULED:
        return {
          title: 'Appointment rescheduled',
          body: `Your visit at ${clinicName} was moved to ${when}.`,
        };
      case PatientNotificationCategory.APPOINTMENT_REMINDER:
        return {
          title: 'Appointment reminder',
          body: `You have an appointment at ${clinicName} on ${when}.`,
        };
      case PatientNotificationCategory.APPOINTMENT_CONFIRMED:
        return {
          title: 'Appointment confirmed',
          body: `Your booking at ${clinicName} on ${when} is confirmed.`,
        };
      default:
        return {
          title: 'MediCare update',
          body: `There is an update about your care at ${clinicName}.`,
        };
    }
  }

  private async deliverToPatient(
    userId: string,
    input: {
      category: PatientNotificationCategory;
      title: string;
      body: string;
      appointmentId?: string;
      clinicId?: string;
      data: Record<string, unknown>;
    },
  ): Promise<{ pushSuccess: number; pushFailed: number }> {
    const inbox = await this.inboxRepo.save(
      this.inboxRepo.create({
        userId,
        category: input.category,
        title: input.title,
        body: input.body,
        appointmentId: input.appointmentId ?? null,
        clinicId: input.clinicId ?? null,
        data: input.data,
      }),
    );

    const tokens = await this.tokenRepo.find({
      where: { userId, enabled: true, tenantId: IsNull() },
    });
    if (!tokens.length) {
      this.logger.warn(`No FCM device token for patient ${userId} — inbox saved, push skipped`);
      return { pushSuccess: 0, pushFailed: 0 };
    }

    const stringData: Record<string, string> = {
      notificationId: inbox.id,
      category: input.category,
      title: input.title,
      body: input.body,
      deepLink: String(input.data.deepLink ?? '/notifications'),
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
      {
        // notification+data: Play Services draws the tray when the app is killed.
        // Data-only relied on the Flutter isolate, which Samsung often blocks.
        androidChannelId: 'medicare_patient',
        deepLink: stringData.deepLink,
        androidDataOnly: false,
      },
    );

    if (result.invalidTokens.length) {
      await this.tokenRepo.delete({ fcmToken: In(result.invalidTokens) });
    }

    this.logger.log(
      `Patient push ${userId}: ${result.successCount} ok, ${result.failureCount} failed`,
    );

    return {
      pushSuccess: result.successCount,
      pushFailed: result.failureCount,
    };
  }
}
