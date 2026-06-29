import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum RateLimitType {
  LOGIN          = 'login',
  OTP            = 'otp',
  OTP_VERIFY     = 'otp_verify',   // NEW — limits guesses per active OTP
  REGISTER       = 'register',
  API            = 'api',
  PASSWORD_RESET = 'password_reset',
  REFRESH        = 'refresh',
}

@Entity('rate_limits')
@Index(['identifier'])
@Index(['type'])
@Index(['expiresAt'])
export class RateLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  identifier: string;

  @Column({ type: 'enum', enum: RateLimitType })
  type: RateLimitType;

  @Column({ default: 0 })
  count: number;

  @Column({ default: 5 })
  maxRequests: number;

  @Column({ type: 'timestamp' })
  windowStart: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ nullable: true })
  blockedUntil: Date;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    ip?: string;
    userAgent?: string;
    lastAttemptAt?: Date;
    attempts?: Array<{ timestamp: Date; success: boolean }>;
  };

  @CreateDateColumn()
  createdAt: Date;

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isCurrentlyBlocked(): boolean {
    if (!this.isBlocked || !this.blockedUntil) return false;
    return this.blockedUntil > new Date();
  }

  canMakeRequest(): boolean {
    if (this.isCurrentlyBlocked()) return false;
    if (this.isExpired()) return true;
    return this.count < this.maxRequests;
  }

  increment(): void {
    this.count += 1;
    if (this.count >= this.maxRequests) {
      this.isBlocked = true;
      this.blockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  reset(): void {
    this.count = 0;
    this.isBlocked = false;
    this.blockedUntil = null;
    this.windowStart = new Date();
  }
}
