import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum DoctorPatientAssignmentStatus {
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
}

@Entity('doctor_patient_assignments')
@Unique(['tenantId', 'doctorId', 'patientId'])
@Index(['tenantId', 'doctorId'])
@Index(['tenantId', 'patientId'])
export class DoctorPatientAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @Column('uuid', { name: 'doctor_id' })
  doctorId: string;

  @Column('uuid', { name: 'patient_id' })
  patientId: string;

  @Column('uuid', { name: 'assigned_by', nullable: true })
  assignedBy: string | null;

  @Column({ type: 'varchar', length: 20, default: DoctorPatientAssignmentStatus.ACTIVE })
  status: DoctorPatientAssignmentStatus;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
