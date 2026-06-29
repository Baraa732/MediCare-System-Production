import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';

export enum SessionStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

@Entity('sessions')
@Index(['userId'])
@Index(['sessionId'])
@Index(['refreshTokenHash'])
@Index(['tokenFamilyId'])
@Index(['status', 'expiresAt'])
@Index(['tenantId', 'status', 'expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sessionId: string;

  @Column()
  userId: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ nullable: true })
  refreshTokenHash: string;

  @Column({ type: 'jsonb', nullable: true })
  deviceInfo: {
    userAgent?: string;
    ip?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
  };

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE
  })
  status: SessionStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date;

  @Column({ default: 0 })
  tokenRotationCount: number;

  @Column({ nullable: true })
  tokenFamilyId: string;

  @Column({ default: false })
  reuseDetected: boolean;

  @Column({ default: false })
  isSuspicious: boolean;

  @Column({ nullable: true })
  suspiciousReason: string;

  @Column({ default: false })
  isCurrent: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateSessionId() {
    if (!this.sessionId) {
      this.sessionId = this.generateRandomString(64);
    }
  }

  private generateRandomString(length: number): string {
    // crypto.randomBytes is CSPRNG — Math.random() is NOT safe for session IDs
    return require('crypto').randomBytes(length).toString('hex').substring(0, length);
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isActive(): boolean {
    return this.status === SessionStatus.ACTIVE && !this.isExpired();
  }

  revoke() {
    this.status = SessionStatus.REVOKED;
    this.revokedAt = new Date();
  }

  updateLastActivity() {
    this.lastActivityAt = new Date();
  }

  incrementTokenRotation() {
    this.tokenRotationCount += 1;
  }
}
