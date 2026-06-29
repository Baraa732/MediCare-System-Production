import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('doctor_availability')
@Index(['tenantId', 'doctorId', 'dayOfWeek'])
export class DoctorAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @Column('uuid')
  doctorId: string;

  @Column({ type: 'smallint' })
  dayOfWeek: number;

  @Column({ length: 5 })
  startTime: string;

  @Column({ length: 5 })
  endTime: string;

  @Column({ type: 'int', default: 30 })
  slotDurationMinutes: number;
}
