import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum EmrSyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

@Entity('patient_emr_links')
@Index(['tenantId'])
@Index(['tenantId', 'userId'], { unique: true })
@Index(['tenantId', 'openemrPatientId'])
export class PatientEmrLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId: string | null;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  openemrPatientId: string | null;

  @Column({ type: 'enum', enum: EmrSyncStatus, default: EmrSyncStatus.PENDING })
  syncStatus: EmrSyncStatus;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phoneNumber: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
