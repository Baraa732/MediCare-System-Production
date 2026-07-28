import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { instrumentIoredisClient } from '@medicare/telemetry';
import { AccountLock, LockTierDb } from '../entities/account-lock.entity';

export enum LockTier {
  NONE         = 'none',
  SHORT        = 'short',        // 5  fails → 1 min
  MEDIUM       = 'medium',       // 10 fails → 5 min
  ADMIN_REVIEW = 'admin_review', // 20 fails → manual unlock required
}

export interface LockStatus {
  isLocked: boolean;
  tier: LockTier;
  retryAfterSeconds?: number;
  failedAttempts: number;
  requiresAdminReview: boolean;
}

const TIERS: Array<{ threshold: number; lockSeconds: number; tier: LockTier }> = [
  { threshold: 20, lockSeconds: -1,   tier: LockTier.ADMIN_REVIEW },
  { threshold: 10, lockSeconds: 300, tier: LockTier.MEDIUM },
  { threshold: 5,  lockSeconds: 60,  tier: LockTier.SHORT },
];

// Atomic INCR + EXPIRE — eliminates the race between INCR and EXPIRE.
const INCR_WITH_TTL_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class AccountLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountLockService.name);
  private redis: Redis;

  constructor(
    @InjectRepository(AccountLock, 'authConnection')
    private accountLockRepository: Repository<AccountLock>,
  ) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }
    this.redis = instrumentIoredisClient(
      new Redis(redisUrl, {
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        enableOfflineQueue: false,
      }),
      'auth-service',
      'account-lock',
    ) as Redis;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private failKey(id: string) { return `lock:fail:${id}`; }
  private lockKey(id: string) { return `lock:active:${id}`; }
  private tierKey(id: string) { return `lock:tier:${id}`; }

  async recordFailedLogin(identifier: string): Promise<LockStatus> {
    try {
      // Atomic INCR + EXPIRE — fail counter lives 24h to accumulate across lock windows
      const fails = await this.redis.eval(
        INCR_WITH_TTL_SCRIPT,
        1,
        this.failKey(identifier),
        '86400',
      ) as number;

      const matchedTier = TIERS.find(t => fails >= t.threshold);

      let lockStatus: LockStatus;

      if (matchedTier) {
        if (matchedTier.lockSeconds === -1) {
          await this.redis.set(this.lockKey(identifier), '1');
          await this.redis.set(this.tierKey(identifier), LockTier.ADMIN_REVIEW);
          this.logger.error(`Account requires admin review: ${identifier} (${fails} failed attempts)`);
          lockStatus = { isLocked: true, tier: LockTier.ADMIN_REVIEW, failedAttempts: fails, requiresAdminReview: true };
        } else {
          await this.redis.set(this.lockKey(identifier), '1', 'EX', matchedTier.lockSeconds);
          await this.redis.set(this.tierKey(identifier), matchedTier.tier, 'EX', matchedTier.lockSeconds);
          this.logger.warn(`Account locked [${matchedTier.tier}]: ${identifier} for ${matchedTier.lockSeconds}s`);
          lockStatus = {
            isLocked: true,
            tier: matchedTier.tier,
            retryAfterSeconds: matchedTier.lockSeconds,
            failedAttempts: fails,
            requiresAdminReview: false,
          };
        }
      } else {
        lockStatus = { isLocked: false, tier: LockTier.NONE, failedAttempts: fails, requiresAdminReview: false };
      }

      // Fix 4: Dual-write to DB so fallback is always current
      await this.upsertAccountLock(identifier, lockStatus, fails);

      return lockStatus;
    } catch (err: any) {
      this.logger.error(`AccountLockService Redis error in recordFailedLogin: ${err.message}`);
      // Even if Redis is down, still record in DB
      try {
        const existing = await this.accountLockRepository.findOne({ where: { identifier } });
        const fails = (existing?.failedAttempts ?? 0) + 1;
        const matchedTier = TIERS.find(t => fails >= t.threshold);
        const lockedUntil = matchedTier && matchedTier.lockSeconds > 0
          ? new Date(Date.now() + matchedTier.lockSeconds * 1000)
          : matchedTier?.lockSeconds === -1 ? null : undefined;
        await this.accountLockRepository.upsert({
          identifier,
          failedAttempts: fails,
          tier: (matchedTier?.tier ?? LockTier.NONE) as unknown as LockTierDb,
          lockedUntil: lockedUntil === undefined ? existing?.lockedUntil ?? null : lockedUntil,
        }, ['identifier']);
      } catch (dbErr: any) {
        this.logger.error(`DB fallback write failed in recordFailedLogin: ${dbErr.message}`);
      }
      return { isLocked: true, tier: LockTier.NONE, failedAttempts: 0, requiresAdminReview: false };
    }
  }

  async getLockStatus(identifier: string): Promise<LockStatus> {
    try {
      const [lockTtl, tierStr, failStr] = await Promise.all([
        this.redis.ttl(this.lockKey(identifier)),
        this.redis.get(this.tierKey(identifier)),
        this.redis.get(this.failKey(identifier)),
      ]);

      const failedAttempts = parseInt(failStr || '0', 10);
      const tier = (tierStr as LockTier) || LockTier.NONE;

      // TTL of -1 means key exists with no expiry → permanent admin-review lock
      if (lockTtl === -1) {
        return { isLocked: true, tier: LockTier.ADMIN_REVIEW, failedAttempts, requiresAdminReview: true };
      }

      if (lockTtl > 0) {
        return { isLocked: true, tier, retryAfterSeconds: lockTtl, failedAttempts, requiresAdminReview: false };
      }

      return { isLocked: false, tier: LockTier.NONE, failedAttempts, requiresAdminReview: false };
    } catch (err: any) {
      // Fix 4: Redis unavailable — fall back to PostgreSQL instead of fail-closed DoS
      this.logger.warn(`getLockStatus Redis error — falling back to DB: ${err.message}`);
      return this.getLockStatusFromDb(identifier);
    }
  }

  /**
   * Fix 4: DB fallback for getLockStatus when Redis is unavailable.
   * Non-locked users can still log in during a Redis outage.
   */
  private async getLockStatusFromDb(identifier: string): Promise<LockStatus> {
    try {
      const lock = await this.accountLockRepository.findOne({ where: { identifier } });

      if (!lock) {
        // No record → user has never been locked
        return { isLocked: false, tier: LockTier.NONE, failedAttempts: 0, requiresAdminReview: false };
      }

      // Permanent lock (admin_review tier — lockedUntil IS NULL)
      if (lock.tier === LockTierDb.ADMIN_REVIEW && lock.lockedUntil === null) {
        return {
          isLocked: true,
          tier: LockTier.ADMIN_REVIEW,
          failedAttempts: lock.failedAttempts,
          requiresAdminReview: true,
        };
      }

      // Timed lock — check if still active
      if (lock.lockedUntil && lock.lockedUntil > new Date()) {
        const retryAfterSeconds = Math.ceil((lock.lockedUntil.getTime() - Date.now()) / 1000);
        return {
          isLocked: true,
          tier: lock.tier as unknown as LockTier,
          retryAfterSeconds,
          failedAttempts: lock.failedAttempts,
          requiresAdminReview: false,
        };
      }

      // Lock expired or no lock
      return { isLocked: false, tier: LockTier.NONE, failedAttempts: lock.failedAttempts, requiresAdminReview: false };
    } catch (dbErr: any) {
      // Both Redis and DB failed — fail closed (security > availability)
      this.logger.error(`getLockStatus DB fallback also failed: ${dbErr.message}`);
      return { isLocked: true, tier: LockTier.NONE, failedAttempts: 0, requiresAdminReview: false };
    }
  }

  private async upsertAccountLock(identifier: string, status: LockStatus, failedAttempts: number): Promise<void> {
    try {
      let lockedUntil: Date | null = null;
      if (status.isLocked && status.retryAfterSeconds) {
        lockedUntil = new Date(Date.now() + status.retryAfterSeconds * 1000);
      } else if (status.requiresAdminReview) {
        lockedUntil = null; // permanent
      }

      await this.accountLockRepository.upsert(
        {
          identifier,
          lockedUntil,
          tier: status.tier as unknown as LockTierDb,
          failedAttempts,
        },
        ['identifier'],
      );
    } catch (err: any) {
      this.logger.error(`Failed to upsert account_locks: ${err.message}`);
    }
  }

  async resetLock(identifier: string): Promise<void> {
    try {
      await this.redis.del(this.failKey(identifier), this.lockKey(identifier), this.tierKey(identifier));
    } catch (err: any) {
      this.logger.error(`resetLock Redis error: ${err.message}`);
    }
    // Also clear DB record
    try {
      await this.accountLockRepository.delete({ identifier });
    } catch (err: any) {
      this.logger.error(`resetLock DB error: ${err.message}`);
    }
  }

  async adminUnlock(identifier: string): Promise<void> {
    try {
      await this.redis.del(this.failKey(identifier), this.lockKey(identifier), this.tierKey(identifier));
      this.logger.log(`Account manually unlocked by admin: ${identifier}`);
    } catch (err: any) {
      this.logger.error(`adminUnlock Redis error: ${err.message}`);
    }
    try {
      await this.accountLockRepository.delete({ identifier });
    } catch (err: any) {
      this.logger.error(`adminUnlock DB error: ${err.message}`);
      throw err;
    }
  }
}
