import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
}

export enum NotificationChannel {
  WHATSAPP = 'WHATSAPP',
}

export enum NotificationStatus {
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('notification_logs')
@Index(['appointmentId', 'type'])
@Index(['patientId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  appointmentId: string;

  @Column({ nullable: true })
  patientId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.WHATSAPP })
  channel: NotificationChannel;

  @Column({ nullable: true, name: 'tenant_id' })
  tenantId: string;

  @Column()
  recipientPhone: string;

  @Column({ type: 'enum', enum: NotificationStatus })
  status: NotificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
