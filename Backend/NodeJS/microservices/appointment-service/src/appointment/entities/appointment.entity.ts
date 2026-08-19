import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AppointmentStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

@Entity('appointments')
@Index(['tenantId', 'scheduledAt'])
@Index(['doctorId', 'scheduledAt'])
@Index(['patientId', 'scheduledAt'])
@Index(['tenantId', 'doctorId', 'scheduledAt'])
@Index(['tenantId', 'createdAt'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  /** @deprecated use tenantId */
  get clinicId(): string {
    return this.tenantId;
  }

  set clinicId(value: string) {
    this.tenantId = value;
  }

  @Column('uuid')
  doctorId: string;

  @Column('uuid', { nullable: true })
  patientId: string | null;

  @Column({ type: 'text', nullable: true })
  guestPatientName: string | null;

  @Column({ type: 'text', nullable: true })
  guestPatientPhone: string | null;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'int', default: 30 })
  durationMinutes: number;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.CONFIRMED })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('uuid')
  createdBy: string;

  @Column('uuid', { nullable: true })
  cancelledBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
