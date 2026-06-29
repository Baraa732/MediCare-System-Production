import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export enum StaffRole {
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  DOCTOR = 'DOCTOR',
  SECRETARY = 'SECRETARY',
}

export enum AssignmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('tenant_staff_assignments')
@Unique(['tenantId', 'userId'])
@Index(['tenantId'])
@Index(['userId', 'status'])
@Index(['tenantId', 'staffRole', 'status'])
export class TenantStaffAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.staffAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 32, name: 'staff_role' })
  staffRole: StaffRole;

  @Column({ type: 'varchar', length: 20, default: AssignmentStatus.ACTIVE })
  status: AssignmentStatus;

  @Column('uuid', { nullable: true, name: 'assigned_by' })
  assignedBy: string;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** @deprecated Use TenantStaffAssignment */
export { TenantStaffAssignment as ClinicStaffAssignment };
