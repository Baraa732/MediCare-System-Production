import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';

@Entity('clinic_hours')
@Unique(['tenantId', 'dayOfWeek'])
export class ClinicHours {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  /** 0=Sunday … 6=Saturday */
  @Column({ type: 'smallint' })
  dayOfWeek: number;

  @Column({ length: 5, default: '09:00' })
  openTime: string;

  @Column({ length: 5, default: '17:00' })
  closeTime: string;

  @Column({ default: false })
  isClosed: boolean;
}
