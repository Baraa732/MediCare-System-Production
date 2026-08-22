import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum ScheduleBlockStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('schedule_blocks')
@Index(['tenantId', 'doctorId', 'startsAt'])
export class ScheduleBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @Column('uuid', { nullable: true })
  doctorId: string | null;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: ScheduleBlockStatus.APPROVED })
  status: ScheduleBlockStatus;

  @Column('uuid')
  createdBy: string;

  @Column('uuid', { name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;
}
