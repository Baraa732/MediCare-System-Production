import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantStaffAssignment } from './tenant-staff-assignment.entity';

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('tenants')
@Index(['status'])
@Index(['slug'], { unique: true })
@Index(['adminPhoneNumber'])
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 20, default: TenantStatus.ACTIVE })
  status: TenantStatus;

  @Column({ name: 'subscription_plan', length: 50, default: 'standard' })
  subscriptionPlan: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  governorate: string;

  @Column({ length: 30, nullable: true })
  phone: string;

  @Column({ length: 200, nullable: true })
  email: string;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string;

  @Column({ length: 64, default: 'Asia/Damascus' })
  timezone: string;

  @Column('uuid', { nullable: true, unique: true, name: 'activation_code_id' })
  activationCodeId: string;

  @Column({ length: 20, nullable: true, unique: true, name: 'admin_phone_number' })
  adminPhoneNumber: string;

  @Column('uuid', { nullable: true, name: 'admin_user_id' })
  adminUserId: string;

  @OneToMany(() => TenantStaffAssignment, (assignment) => assignment.tenant)
  staffAssignments: TenantStaffAssignment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** @deprecated Use Tenant — kept for incremental migration of imports */
export { Tenant as Clinic, TenantStatus as ClinicStatus };
