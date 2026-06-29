import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('schedule_blocks')
@Index(['tenantId', 'doctorId', 'startsAt'])
export class ScheduleBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @Column('uuid', { nullable: true })
  doctorId: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column('uuid')
  createdBy: string;
}
