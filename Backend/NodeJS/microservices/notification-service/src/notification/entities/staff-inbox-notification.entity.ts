import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum StaffNotificationCategory {
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_REQUESTED = 'APPOINTMENT_REQUESTED',
  SYSTEM = 'SYSTEM',
}

@Entity('staff_inbox_notifications')
@Index(['userId', 'readAt', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class StaffInboxNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'enum', enum: StaffNotificationCategory })
  category: StaffNotificationCategory;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ nullable: true })
  appointmentId: string;

  @Column({ nullable: true, name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
