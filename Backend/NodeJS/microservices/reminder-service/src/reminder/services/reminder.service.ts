import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { ScheduledReminder, ReminderStatus } from '../entities/scheduled-reminder.entity';
import { NotificationHttpClient } from './notification-http.client';
import { UserHttpClient } from './user-http.client';
import { ClinicHttpClient } from './clinic-http.client';
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
  status: string;
}

@Injectable()
export class ReminderService {
  private readonly logger: Logger;
  private readonly hoursBefore: number;

  constructor(
    @InjectRepository(ScheduledReminder)
    private readonly reminderRepo: Repository<ScheduledReminder>,
    private readonly notificationHttpClient: NotificationHttpClient,
    private readonly userHttpClient: UserHttpClient,
    private readonly clinicHttpClient: ClinicHttpClient,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientProxy,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(ReminderService.name, tenantContext);
    this.hoursBefore = Number(process.env.REMINDER_HOURS_BEFORE || 24);
  }

  async handleAppointmentCreated(payload: AppointmentEventPayload): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    await this.cancelPending(payload.appointmentId, tenantId);
    await this.scheduleReminder(payload);
  }

  async handleAppointmentUpdated(payload: AppointmentEventPayload): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    await this.cancelPending(payload.appointmentId, tenantId);
    if (payload.status === 'CANCELLED') return;
    await this.scheduleReminder(payload);
  }

  async handleAppointmentCancelled(payload: AppointmentEventPayload): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    await this.cancelPending(payload.appointmentId, tenantId);
  }

  async handleAppointmentCompleted(payload: AppointmentEventPayload): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    await this.cancelPending(payload.appointmentId, tenantId);
  }

  @Cron(process.env.REMINDER_CRON || CronExpression.EVERY_MINUTE)
  async processDueReminders(): Promise<void> {
    const due = await this.reminderRepo.find({
      where: {
        status: ReminderStatus.PENDING,
        remindAt: LessThanOrEqual(new Date()),
      },
      order: { remindAt: 'ASC' },
      take: 50,
    });

    for (const reminder of due) {
      await this.tenantContextRun(reminder.tenantId, () => this.dispatchReminder(reminder));
    }
  }

  private async tenantContextRun(tenantId: string, fn: () => Promise<void>): Promise<void> {
    await this.tenantContext.run({ tenantId, service: process.env.SERVICE_NAME }, fn);
  }

  private async scheduleReminder(payload: AppointmentEventPayload): Promise<void> {
    const tenantId = payload.tenantId ?? payload.clinicId;
    const appointmentAt = new Date(payload.scheduledAt);
    const remindAt = new Date(appointmentAt.getTime() - this.hoursBefore * 60 * 60 * 1000);

    if (remindAt <= new Date()) {
      this.logger.log(`Skipping reminder for ${payload.appointmentId} — within ${this.hoursBefore}h window`);
      return;
    }

    const saved = await this.reminderRepo.save(
      this.reminderRepo.create({
        appointmentId: payload.appointmentId,
        tenantId,
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        appointmentAt,
        remindAt,
        status: ReminderStatus.PENDING,
      }),
    );

    this.kafkaClient.emit(
      KafkaTopics.REMINDER_SCHEDULED,
      withTenantEvent(tenantId, {
        reminderId: saved.id,
        appointmentId: payload.appointmentId,
        tenantId,
        clinicId: tenantId,
        remindAt: remindAt.toISOString(),
      }),
    );
    this.logger.log(`Reminder scheduled for ${payload.appointmentId} at ${remindAt.toISOString()}`);
  }

  private async cancelPending(appointmentId: string, tenantId?: string): Promise<void> {
    const where: Record<string, unknown> = {
      appointmentId,
      status: ReminderStatus.PENDING,
    };
    if (tenantId) where.tenantId = tenantId;
    await this.reminderRepo.update(where as never, { status: ReminderStatus.CANCELLED });
  }

  private async dispatchReminder(reminder: ScheduledReminder): Promise<void> {
    const [patient, doctor, clinicName] = await Promise.all([
      this.userHttpClient.getUserById(reminder.patientId),
      this.userHttpClient.getUserById(reminder.doctorId),
      this.clinicHttpClient.getClinicName(reminder.tenantId),
    ]);

    if (!patient?.phoneNumber) {
      reminder.status = ReminderStatus.FAILED;
      reminder.lastError = 'Patient phone not found';
      await this.reminderRepo.save(reminder);
      this.emitFailed(reminder, reminder.lastError);
      return;
    }

    const appointmentDate = reminder.appointmentAt.toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const appointmentTime = reminder.appointmentAt.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    const ok = await this.notificationHttpClient.sendAppointmentReminder({
      appointmentId: reminder.appointmentId,
      patientId: reminder.patientId,
      tenantId: reminder.tenantId,
      phoneNumber: patient.phoneNumber,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      doctorName: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}`.trim() : 'your doctor',
      appointmentDate,
      appointmentTime,
      clinicName,
    });

    if (ok) {
      reminder.status = ReminderStatus.SENT;
      reminder.sentAt = new Date();
      reminder.lastError = null;
      await this.reminderRepo.save(reminder);
      this.kafkaClient.emit(
        KafkaTopics.REMINDER_SENT,
        withTenantEvent(reminder.tenantId, {
          reminderId: reminder.id,
          appointmentId: reminder.appointmentId,
          tenantId: reminder.tenantId,
        }),
      );
    } else {
      reminder.status = ReminderStatus.FAILED;
      reminder.lastError = 'Notification service returned failure';
      await this.reminderRepo.save(reminder);
      this.emitFailed(reminder, reminder.lastError);
    }
  }

  private emitFailed(reminder: ScheduledReminder, errorMessage: string): void {
    this.kafkaClient.emit(
      KafkaTopics.REMINDER_FAILED,
      withTenantEvent(reminder.tenantId, {
        reminderId: reminder.id,
        appointmentId: reminder.appointmentId,
        tenantId: reminder.tenantId,
        errorMessage,
      }),
    );
  }
}
