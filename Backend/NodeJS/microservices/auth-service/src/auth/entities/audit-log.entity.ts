import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  PROFILE_UPDATE = 'profile_update',
  ROLE_CHANGE = 'role_change',
  TOKEN_REFRESH = 'token_refresh',
  SESSION_CREATED = 'session_created',
  SESSION_REVOKED = 'session_revoked',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  OTP_SENT = 'otp_sent',
  OTP_VERIFIED = 'otp_verified',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  FAILED_LOGIN = 'failed_login',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

export enum AuditResource {
  USER = 'user',
  SESSION = 'session',
  TOKEN = 'token',
  PERMISSION = 'permission',
  OTP = 'otp',
  SYSTEM = 'system'
}

@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['resource'])
@Index(['createdAt'])
@Index(['requestId'])
@Index(['ip'])
@Index(['risk'])
@Index(['tenantId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({
    type: 'enum',
    enum: AuditAction
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditResource
  })
  resource: AuditResource;

  @Column({ nullable: true })
  resourceId: string;

  // Promoted to top-level columns so they can be indexed and queried directly
  @Column({ nullable: true })
  requestId: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  device: string;

  @Column({ nullable: true, default: 'low' })
  risk: 'low' | 'medium' | 'high' | 'critical';

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    userAgent?: string;
    deviceInfo?: Record<string, unknown>;
    oldValues?: unknown;
    newValues?: unknown;
    reason?: string;
    details?: unknown;
    anomalies?: string[];
    previousIp?: string;
    previousCountry?: string;
    newCountry?: string;
  };

  @Column({ default: 'info' })
  severity: 'info' | 'warning' | 'error' | 'critical';

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
