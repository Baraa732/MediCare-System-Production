import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

@Entity('scheduled_reminders')
@Index(['appointmentId', 'status'])
@Index(['tenantId', 'status', 'remindAt'])
export class ScheduledReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  appointmentId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column()
  patientId: string;

  @Column()
  doctorId: string;

  @Column({ type: 'timestamptz' })
  appointmentAt: Date;

  @Column({ type: 'timestamptz' })
  remindAt: Date;

  @Column({ type: 'enum', enum: ReminderStatus, default: ReminderStatus.PENDING })
  status: ReminderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
