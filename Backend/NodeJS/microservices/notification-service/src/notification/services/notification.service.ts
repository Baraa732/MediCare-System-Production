import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import {
  NotificationLog,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '../entities/notification-log.entity';
import { WhatsAppService } from './whatsapp.service';
import { UserHttpClient } from './user-http.client';
import { ClinicHttpClient } from './clinic-http.client';
import { StaffPushService } from './staff-push.service';
import { PatientPushService } from './patient-push.service';
import { formatClinicDate, formatClinicTime } from '../utils/clinic-datetime.util';
import { StaffNotificationCategory } from '../entities/staff-inbox-notification.entity';
import { AppointmentReminderDto } from '../dto/notification.dto';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

export type AppointmentChangeKind =
  | 'RESCHEDULED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'STATUS';

export interface AppointmentEventPayload extends Record<string, unknown> {
  appointmentId: string;
  clinicId: string;
  tenantId?: string;
  doctorId: string;
  patientId?: string | null;
  guestPatientName?: string | null;
  guestPatientPhone?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  status: string;
  timestamp?: string;
  changeKind?: AppointmentChangeKind;
  previousStatus?: string;
  previousScheduledAt?: string;
  previousDoctorId?: string;
}

function resolveUpdateKind(payload: AppointmentEventPayload): AppointmentChangeKind | 'SKIP' {
  if (payload.changeKind === 'RESCHEDULED' || payload.changeKind === 'CONFIRMED' || payload.changeKind === 'NO_SHOW') {
    return payload.changeKind;
  }
  if (payload.changeKind === 'STATUS' || payload.changeKind === 'COMPLETED' || payload.changeKind === 'CANCELLED') {
    return 'SKIP';
  }

  const previousStatus = payload.previousStatus;
  if (previousStatus === 'REQUESTED' && payload.status === 'CONFIRMED') {
    return 'CONFIRMED';
  }
  if (payload.status === 'NO_SHOW') {
    return 'NO_SHOW';
  }

  const previousTime = payload.previousScheduledAt
    ? Date.parse(payload.previousScheduledAt)
    : NaN;
  const nextTime = Date.parse(payload.scheduledAt);
  const timeChanged =
    Number.isFinite(previousTime) &&
    Number.isFinite(nextTime) &&
    Math.abs(nextTime - previousTime) >= 30_000;
  const doctorChanged =
    typeof payload.previousDoctorId === 'string' &&
    payload.previousDoctorId !== payload.doctorId;

  if (timeChanged || doctorChanged) return 'RESCHEDULED';
  // Legacy events without change metadata used to spam "rescheduled". Drop them.
  return 'SKIP';
}

@Injectable()
export class NotificationService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    private readonly whatsAppService: WhatsAppService,
    private readonly userHttpClient: UserHttpClient,
    private readonly clinicHttpClient: ClinicHttpClient,
    private readonly staffPushService: StaffPushService,
    private readonly patientPushService: PatientPushService,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientProxy,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(NotificationService.name, tenantContext);
  }

  async handleAppointmentCreated(payload: AppointmentEventPayload): Promise<void> {
    if (payload.status !== 'REQUESTED') {
      await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_CONFIRMED);
    }
    if (payload.patientId) {
      await this.patientPushService.notifyFromAppointmentEvent(
        payload,
        NotificationType.APPOINTMENT_CONFIRMED,
      );
    }
    const category =
      payload.status === 'REQUESTED'
        ? StaffNotificationCategory.APPOINTMENT_REQUESTED
        : StaffNotificationCategory.APPOINTMENT_CREATED;
    await this.staffPushService.notifyDoctorAppointment(payload, category);
    await this.staffPushService.notifyClinicSecretaries(payload, category);
  }

  async handleAppointmentCancelled(payload: AppointmentEventPayload): Promise<void> {
    await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_CANCELLED);
    if (payload.patientId) {
      await this.patientPushService.notifyFromAppointmentEvent(
        payload,
        NotificationType.APPOINTMENT_CANCELLED,
      );
    }
    await this.staffPushService.notifyDoctorAppointment(
      payload,
      StaffNotificationCategory.APPOINTMENT_CANCELLED,
    );
    await this.staffPushService.notifyClinicSecretaries(
      payload,
      StaffNotificationCategory.APPOINTMENT_CANCELLED,
    );
    await this.staffPushService.notifyGuestCallIfNeeded(payload, 'cancelled');
  }

  async handleAppointmentUpdated(payload: AppointmentEventPayload): Promise<void> {
    const kind = resolveUpdateKind(payload);
    if (kind === 'SKIP') {
      this.logger.log(
        `Skipping appointment.updated notifications for ${payload.appointmentId} (no schedule/status change)`,
      );
      return;
    }

    if (kind === 'CONFIRMED') {
      await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_CONFIRMED);
      if (payload.patientId) {
        await this.patientPushService.notifyFromAppointmentEvent(
          payload,
          NotificationType.APPOINTMENT_CONFIRMED,
        );
      }
      await this.staffPushService.notifyDoctorAppointment(
        payload,
        StaffNotificationCategory.APPOINTMENT_CREATED,
      );
      await this.staffPushService.notifyClinicSecretaries(
        payload,
        StaffNotificationCategory.APPOINTMENT_CREATED,
      );
      return;
    }

    if (kind === 'NO_SHOW') {
      await this.staffPushService.notifyDoctorAppointment(
        payload,
        StaffNotificationCategory.APPOINTMENT_UPDATED,
      );
      await this.staffPushService.notifyClinicSecretaries(
        payload,
        StaffNotificationCategory.APPOINTMENT_UPDATED,
      );
      return;
    }

    await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_RESCHEDULED);
    if (payload.patientId) {
      await this.patientPushService.notifyFromAppointmentEvent(
        payload,
        NotificationType.APPOINTMENT_RESCHEDULED,
      );
    }
    await this.staffPushService.notifyDoctorAppointment(
      payload,
      StaffNotificationCategory.APPOINTMENT_UPDATED,
    );
    await this.staffPushService.notifyClinicSecretaries(
      payload,
      StaffNotificationCategory.APPOINTMENT_UPDATED,
    );
    await this.staffPushService.notifyGuestCallIfNeeded(payload, 'rescheduled');
  }

  async sendAppointmentReminder(dto: AppointmentReminderDto): Promise<{ success: boolean }> {
    const tenantId = dto.tenantId ?? this.tenantContext.getTenantId() ?? undefined;
    try {
      await this.whatsAppService.sendAppointmentReminder(
        dto.phoneNumber,
        dto.patientName,
        dto.doctorName,
        dto.appointmentDate,
        dto.appointmentTime,
        dto.clinicName,
      );
      await this.persistLog({
        appointmentId: dto.appointmentId,
        patientId: dto.patientId,
        tenantId,
        type: NotificationType.APPOINTMENT_REMINDER,
        recipientPhone: dto.phoneNumber,
        status: NotificationStatus.SENT,
        payload: dto as unknown as Record<string, unknown>,
      });
      this.emitOutcome(
        KafkaTopics.NOTIFICATION_SENT,
        dto.appointmentId,
        NotificationType.APPOINTMENT_REMINDER,
        tenantId,
      );
      await this.patientPushService.notifyReminder(dto);
      return { success: true };
    } catch (error: any) {
      const message = error?.message || 'Reminder send failed';
      this.logger.error(`Reminder failed for ${dto.appointmentId}: ${message}`);
      await this.persistLog({
        appointmentId: dto.appointmentId,
        patientId: dto.patientId,
        tenantId,
        type: NotificationType.APPOINTMENT_REMINDER,
        recipientPhone: dto.phoneNumber,
        status: NotificationStatus.FAILED,
        payload: dto as unknown as Record<string, unknown>,
        errorMessage: message,
      });
      this.emitOutcome(
        KafkaTopics.NOTIFICATION_FAILED,
        dto.appointmentId,
        NotificationType.APPOINTMENT_REMINDER,
        tenantId,
        message,
      );
      return { success: false };
    }
  }

  private async sendAppointmentNotification(
    payload: AppointmentEventPayload,
    type: NotificationType,
  ): Promise<void> {
    const context = await this.resolveContext(payload);
    if (!context) return;

    const { phoneNumber, patientName, doctorName, clinicName, appointmentDate, appointmentTime } = context;

    try {
      if (type === NotificationType.APPOINTMENT_CONFIRMED) {
        await this.whatsAppService.sendAppointmentConfirmed(
          phoneNumber, patientName, doctorName, appointmentDate, appointmentTime, clinicName,
        );
      } else if (type === NotificationType.APPOINTMENT_CANCELLED) {
        await this.whatsAppService.sendAppointmentCancelled(
          phoneNumber, patientName, doctorName, appointmentDate, appointmentTime, clinicName,
        );
      } else {
        await this.whatsAppService.sendAppointmentRescheduled(
          phoneNumber, patientName, doctorName, appointmentDate, appointmentTime, clinicName,
        );
      }

      await this.persistLog({
        appointmentId: payload.appointmentId,
        patientId: payload.patientId,
        tenantId: payload.tenantId ?? payload.clinicId,
        type,
        recipientPhone: phoneNumber,
        status: NotificationStatus.SENT,
        payload: payload as unknown as Record<string, unknown>,
      });
      this.emitOutcome(
        KafkaTopics.NOTIFICATION_SENT,
        payload.appointmentId,
        type,
        payload.tenantId ?? payload.clinicId,
      );
    } catch (error: any) {
      const message = error?.message || 'Notification send failed';
      this.logger.error(`${type} failed for ${payload.appointmentId}: ${message}`);
      await this.persistLog({
        appointmentId: payload.appointmentId,
        patientId: payload.patientId,
        tenantId: payload.tenantId ?? payload.clinicId,
        type,
        recipientPhone: phoneNumber,
        status: NotificationStatus.FAILED,
        payload: payload as unknown as Record<string, unknown>,
        errorMessage: message,
      });
      this.emitOutcome(
        KafkaTopics.NOTIFICATION_FAILED,
        payload.appointmentId,
        type,
        payload.tenantId ?? payload.clinicId,
        message,
      );
    }
  }

  private async resolveContext(payload: AppointmentEventPayload) {
    const [patient, doctor, clinic] = await Promise.all([
      payload.patientId ? this.userHttpClient.getUserById(payload.patientId).catch(() => null) : null,
      this.userHttpClient.getUserById(payload.doctorId),
      this.clinicHttpClient.getClinicById(payload.clinicId),
    ]);

    const phoneNumber = patient?.phoneNumber ?? payload.guestPatientPhone ?? undefined;
    if (!phoneNumber) {
      this.logger.warn(`Skipping notification — appointment ${payload.appointmentId} has no patient phone`);
      return null;
    }

    const scheduled = new Date(payload.scheduledAt);
    const clinicTimezone = clinic?.timezone;
    const appointmentDate = formatClinicDate(scheduled, clinicTimezone);
    const appointmentTime = formatClinicTime(scheduled, clinicTimezone);

    return {
      phoneNumber,
      patientName:
        `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim() ||
        payload.guestPatientName ||
        'Patient',
      doctorName: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}`.trim() : 'your doctor',
      clinicName: clinic?.name || 'the clinic',
      appointmentDate,
      appointmentTime,
    };
  }

  private async persistLog(data: {
    appointmentId: string;
    patientId?: string;
    tenantId?: string;
    type: NotificationType;
    recipientPhone: string;
    status: NotificationStatus;
    payload: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    const tenantId =
      data.tenantId ??
      (data.payload.tenantId as string | undefined) ??
      (data.payload.clinicId as string | undefined) ??
      this.tenantContext.getTenantId() ??
      undefined;

    if (!tenantId) {
      this.logger.warn(
        `Skipping notification log — missing tenantId for appointment ${data.appointmentId}`,
      );
      return;
    }

    await this.logRepo.save(
      this.logRepo.create({
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        tenantId,
        type: data.type,
        channel: NotificationChannel.WHATSAPP,
        recipientPhone: data.recipientPhone,
        status: data.status,
        payload: data.payload,
        errorMessage: data.errorMessage,
      }),
    );
  }

  async listForPatient(
    patientId: string,
    options: { page: number; limit: number },
  ): Promise<{
    items: Array<{
      id: string;
      appointmentId: string | null;
      type: NotificationType;
      channel: NotificationChannel;
      status: NotificationStatus;
      createdAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const qb = this.logRepo
      .createQueryBuilder('log')
      .where(
        '(log.patientId = :patientId OR log.payload ->> \'patientId\' = :patientId)',
        { patientId },
      )
      .orderBy('log.createdAt', 'DESC');

    const ctxTenant = this.tenantContext.getTenantId();
    if (ctxTenant) {
      qb.andWhere('log.tenant_id = :ctxTenantId', { ctxTenantId: ctxTenant });
    }

    const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items: rows.map((row) => ({
        id: row.id,
        appointmentId: row.appointmentId,
        type: row.type,
        channel: row.channel,
        status: row.status,
        createdAt: row.createdAt,
      })),
      page,
      limit,
      total,
    };
  }

  private emitOutcome(
    topic: KafkaTopics,
    appointmentId: string,
    type: NotificationType,
    tenantId?: string,
    errorMessage?: string,
  ): void {
    const resolvedTenantId = tenantId ?? undefined;
    const payload = {
      appointmentId,
      type,
      channel: NotificationChannel.WHATSAPP,
      errorMessage,
    };
    this.kafkaClient.emit(
      topic,
      resolvedTenantId ? withTenantEvent(resolvedTenantId, payload) : payload,
    );
  }
}
