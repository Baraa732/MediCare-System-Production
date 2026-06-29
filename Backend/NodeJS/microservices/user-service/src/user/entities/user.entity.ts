import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, DeleteDateColumn } from 'typeorm';
import { UserRole, UserStatus } from './user.enums';

export { UserRole, UserStatus };

@Entity('users')
@Index(['phoneNumber'], { unique: true })
@Index(['email'], { unique: true, where: '"email" IS NOT NULL' })
@Index(['status', 'role'])
@Index(['tenantId', 'status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true, unique: true })
  username: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PATIENT,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isDashboardActivated: boolean; // For clinic admins - tracks if dashboard has been activated via code

  @Column({ default: false })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  activationExpiresAt: Date | null;

  @Column({ nullable: true })
  linkedSystemManagerId: string; // Reference to system manager if this user is linked to one

  @Column({ nullable: true, name: 'tenant_id' })
  tenantId: string;

  /** @deprecated use tenantId — kept for API compatibility during migration */
  get clinicId(): string | undefined {
    return this.tenantId;
  }

  set clinicId(value: string | undefined) {
    this.tenantId = value;
  }

  @Column({ type: 'simple-array', default: [] })
  permissions: string[];

  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  licenseNumber: string;

  @Column({ type: 'jsonb', nullable: true })
  profileData: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  // Methods
  getDefaultPermissionsForRole(): string[] {
    switch (this.role) {
      case UserRole.SYSTEM_MANAGER:
        return ['*'];
      case UserRole.CLINIC_ADMIN:
        return ['create:users', 'read:users', 'update:users', 'delete:users', 'manage:appointments', 'manage:clinics'];
      case UserRole.DOCTOR:
        return ['read:appointments', 'update:appointments', 'read:patients', 'create:prescriptions'];
      case UserRole.SECRETARY:
        return ['read:appointments', 'create:appointments', 'read:patients'];
      case UserRole.PATIENT:
        return ['read:own:appointments', 'create:own:appointments', 'read:own:records'];
      default:
        return [];
    }
  }

  hasPermission(permission: string): boolean {
    if (this.permissions.includes('*')) return true;
    return this.permissions.includes(permission);
  }

  canCreateUser(targetRole: UserRole): boolean {
    if (this.role === UserRole.SYSTEM_MANAGER) return true;
    if (this.role === UserRole.CLINIC_ADMIN) {
      return [UserRole.DOCTOR, UserRole.SECRETARY].includes(targetRole);
    }
    return false;
  }
}
