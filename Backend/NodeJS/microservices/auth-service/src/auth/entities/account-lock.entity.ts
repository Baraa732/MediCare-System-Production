import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum LockTierDb {
  NONE         = 'none',
  SHORT        = 'short',
  MEDIUM       = 'medium',
  ADMIN_REVIEW = 'admin_review',
}

/**
 * Fix 4: PostgreSQL fallback for account lock state.
 * Written on every recordFailedLogin() (dual-write with Redis).
 * Read only when Redis is unavailable.
 */
@Entity('account_locks')
export class AccountLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  identifier: string;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ length: 20, default: LockTierDb.NONE })
  tier: LockTierDb;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
