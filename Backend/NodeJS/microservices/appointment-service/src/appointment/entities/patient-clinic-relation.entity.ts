import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('patient_clinic_relations')
@Unique(['patientId', 'tenantId'])
@Index(['patientId'])
@Index(['tenantId'])
export class PatientClinicRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'patient_id' })
  patientId: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn({ name: 'first_seen_at' })
  firstSeenAt: Date;

  @UpdateDateColumn({ name: 'last_seen_at' })
  lastSeenAt: Date;
}
