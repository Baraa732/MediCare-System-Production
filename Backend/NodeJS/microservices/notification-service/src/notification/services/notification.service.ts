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
import { StaffNotificationCategory } from '../entities/staff-inbox-notification.entity';
import { AppointmentReminderDto } from '../dto/notification.dto';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';

export interface AppointmentEventPayload extends Record<string, unknown> {
  appointmentId: string;
  clinicId: string;
  tenantId?: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  durationMinutes?: number;
  status: string;
  timestamp?: string;
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
    await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_CONFIRMED);
    await this.patientPushService.notifyFromAppointmentEvent(
      payload,
      NotificationType.APPOINTMENT_CONFIRMED,
    );
    const category =
      payload.status === 'REQUESTED'
        ? StaffNotificationCategory.APPOINTMENT_REQUESTED
        : StaffNotificationCategory.APPOINTMENT_CREATED;
    await this.staffPushService.notifyClinicSecretaries(payload, category);
  }

  async handleAppointmentCancelled(payload: AppointmentEventPayload): Promise<void> {
    await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_CANCELLED);
    await this.patientPushService.notifyFromAppointmentEvent(
      payload,
      NotificationType.APPOINTMENT_CANCELLED,
    );
    await this.staffPushService.notifyClinicSecretaries(
      payload,
      StaffNotificationCategory.APPOINTMENT_CANCELLED,
    );
  }

  async handleAppointmentUpdated(payload: AppointmentEventPayload): Promise<void> {
    await this.sendAppointmentNotification(payload, NotificationType.APPOINTMENT_RESCHEDULED);
    await this.patientPushService.notifyFromAppointmentEvent(
      payload,
      NotificationType.APPOINTMENT_RESCHEDULED,
    );
    await this.staffPushService.notifyClinicSecretaries(
      payload,
      StaffNotificationCategory.APPOINTMENT_UPDATED,
    );
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
      this.userHttpClient.getUserById(payload.patientId),
      this.userHttpClient.getUserById(payload.doctorId),
      this.clinicHttpClient.getClinicById(payload.clinicId),
    ]);

    if (!patient?.phoneNumber) {
      this.logger.warn(`Skipping notification — patient ${payload.patientId} has no phone`);
      return null;
    }

    const scheduled = new Date(payload.scheduledAt);
    const appointmentDate = scheduled.toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const appointmentTime = scheduled.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    return {
      phoneNumber: patient.phoneNumber,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
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
