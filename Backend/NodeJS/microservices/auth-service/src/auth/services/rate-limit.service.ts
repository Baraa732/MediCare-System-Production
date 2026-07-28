import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { instrumentIoredisClient } from '@medicare/telemetry';
import { RateLimitType } from '../entities/rate-limit.entity';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  blockSeconds: number;
}

/** Failed login tiers: 5 fails → 1 min block, 10 fails → 5 min block. */
export const LOGIN_FAIL_TIERS = [
  { threshold: 10, blockSeconds: 300 },
  { threshold: 5, blockSeconds: 60 },
] as const;

export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  [RateLimitType.LOGIN]:          { maxRequests: 10, windowSeconds: 3600, blockSeconds: 60  },
  [RateLimitType.OTP]:            { maxRequests: 3,  windowSeconds: 300,  blockSeconds: 900  },
  [RateLimitType.OTP_VERIFY]:     { maxRequests: 5,  windowSeconds: 600,  blockSeconds: 1800 },
  [RateLimitType.REGISTER]:       { maxRequests: 3,  windowSeconds: 900,  blockSeconds: 3600 },
  [RateLimitType.API]:            { maxRequests: 100, windowSeconds: 60,  blockSeconds: 300  },
  [RateLimitType.PASSWORD_RESET]: { maxRequests: 3,  windowSeconds: 900,  blockSeconds: 3600 },
  [RateLimitType.REFRESH]:        { maxRequests: 20, windowSeconds: 300,  blockSeconds: 600  },
};

// Lua script: atomically INCR and set TTL only on first call.
// Eliminates the INCR → crash → no EXPIRE race condition.
// Returns the new counter value.
const INCR_WITH_TTL_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private redis: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required — no fallback allowed in production');
    }
    this.redis = instrumentIoredisClient(
      new Redis(redisUrl, {
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        enableOfflineQueue: false,
      }),
      'auth-service',
      'rate-limit',
    ) as Redis;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async checkRateLimit(
    identifier: string,
    type: RateLimitType,
  ): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
    const config = RATE_LIMIT_CONFIGS[type];
    const blockKey = `rl:block:${type}:${identifier}`;
    const countKey = `rl:count:${type}:${identifier}`;

    try {
      // Check block key first
      const blockedTtl = await this.redis.ttl(blockKey);
      if (blockedTtl > 0) {
        return { allowed: false, remaining: 0, retryAfter: blockedTtl };
      }

      // Atomic INCR + EXPIRE via Lua — no race condition
      const count = await this.redis.eval(
        INCR_WITH_TTL_SCRIPT,
        1,
        countKey,
        String(config.windowSeconds),
      ) as number;

      if (count > config.maxRequests) {
        await this.redis.set(blockKey, '1', 'EX', config.blockSeconds);
        await this.redis.del(countKey);
        this.logger.warn(`Rate limit exceeded: ${type} for ${identifier}`);
        return { allowed: false, remaining: 0, retryAfter: config.blockSeconds };
      }

      return { allowed: true, remaining: config.maxRequests - count };
    } catch (err: any) {
      // Redis unavailable — fail OPEN for rate limiting (availability > security here)
      // Account locking is the hard security backstop.
      this.logger.error(`RateLimitService Redis error (fail-open): ${err.message}`);
      return { allowed: true, remaining: 1 };
    }
  }

  async recordFailedAttempt(identifier: string, type: RateLimitType): Promise<void> {
    if (type === RateLimitType.LOGIN) {
      await this.recordLoginFailedAttempt(identifier);
      return;
    }

    const config = RATE_LIMIT_CONFIGS[type];
    const failKey  = `rl:fail:${type}:${identifier}`;
    const blockKey = `rl:block:${type}:${identifier}`;

    try {
      const fails = await this.redis.eval(
        INCR_WITH_TTL_SCRIPT,
        1,
        failKey,
        String(config.windowSeconds),
      ) as number;

      if (fails >= config.maxRequests) {
        await this.redis.set(blockKey, '1', 'EX', config.blockSeconds);
        await this.redis.del(failKey);
        this.logger.warn(`Blocked after ${fails} failed attempts: ${type} for ${identifier}`);
      }
    } catch (err: any) {
      this.logger.error(`recordFailedAttempt Redis error: ${err.message}`);
    }
  }

  /** Tiered login blocks: 5 failed attempts → 1 min, 10 → 5 min. */
  async recordLoginFailedAttempt(identifier: string): Promise<void> {
    const type = RateLimitType.LOGIN;
    const failKey = `rl:fail:${type}:${identifier}`;
    const blockKey = `rl:block:${type}:${identifier}`;
    const failWindowSeconds = 86400;

    try {
      const fails = await this.redis.eval(
        INCR_WITH_TTL_SCRIPT,
        1,
        failKey,
        String(failWindowSeconds),
      ) as number;

      const tier = LOGIN_FAIL_TIERS.find((t) => fails >= t.threshold);
      if (!tier) return;

      const currentTtl = await this.redis.ttl(blockKey);
      if (currentTtl < tier.blockSeconds) {
        await this.redis.set(blockKey, '1', 'EX', tier.blockSeconds);
      }
      this.logger.warn(
        `Login blocked after ${fails} failed attempts: ${identifier} for ${tier.blockSeconds}s`,
      );
    } catch (err: any) {
      this.logger.error(`recordLoginFailedAttempt Redis error: ${err.message}`);
    }
  }

  async resetRateLimit(identifier: string, type: RateLimitType): Promise<void> {
    const blockKey = `rl:block:${type}:${identifier}`;
    const countKey = `rl:count:${type}:${identifier}`;
    const failKey  = `rl:fail:${type}:${identifier}`;
    try {
      await this.redis.del(blockKey, countKey, failKey);
    } catch (err: any) {
      this.logger.error(`resetRateLimit Redis error: ${err.message}`);
    }
  }

  async getRateLimitStatus(identifier: string, type: RateLimitType): Promise<{
    isBlocked: boolean;
    retryAfter?: number;
    remaining: number;
  }> {
    const config = RATE_LIMIT_CONFIGS[type];
    const blockKey = `rl:block:${type}:${identifier}`;
    const countKey = `rl:count:${type}:${identifier}`;

    try {
      const [blockedTtl, countStr] = await Promise.all([
        this.redis.ttl(blockKey),
        this.redis.get(countKey),
      ]);

      if (blockedTtl > 0) {
        return { isBlocked: true, retryAfter: blockedTtl, remaining: 0 };
      }

      const count = parseInt(countStr || '0', 10);
      return { isBlocked: false, remaining: Math.max(0, config.maxRequests - count) };
    } catch (err: any) {
      this.logger.error(`getRateLimitStatus Redis error: ${err.message}`);
      return { isBlocked: false, remaining: config.maxRequests };
    }
  }

  async checkRateLimitByIp(
    ip: string,
    type: RateLimitType,
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    return this.checkRateLimit(`ip:${ip}`, type);
  }

  /**
   * Combined IP+phone block check — read-only; increments happen on failed login only.
   */
  async checkCombinedRateLimit(
    ip: string,
    phone: string,
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const blockKey = `rl:combined:block:${ip}:${phone}`;

    try {
      const blockedTtl = await this.redis.ttl(blockKey);
      if (blockedTtl > 0) {
        return { allowed: false, retryAfter: blockedTtl };
      }
      return { allowed: true };
    } catch (err: any) {
      this.logger.error(`checkCombinedRateLimit Redis error (fail-open): ${err.message}`);
      return { allowed: true };
    }
  }

  /** Count failed logins per IP+phone pair — blocks after repeated bad passwords. */
  async recordCombinedFailedAttempt(ip: string, phone: string): Promise<void> {
    const combinedKey = `rl:combined:${ip}:${phone}`;
    const blockKey = `rl:combined:block:${ip}:${phone}`;
    const failWindowSeconds = 86400;

    try {
      const fails = (await this.redis.eval(
        INCR_WITH_TTL_SCRIPT,
        1,
        combinedKey,
        String(failWindowSeconds),
      )) as number;

      const tier = LOGIN_FAIL_TIERS.find((t) => fails >= t.threshold);
      if (!tier) return;

      const currentTtl = await this.redis.ttl(blockKey);
      if (currentTtl < tier.blockSeconds) {
        await this.redis.set(blockKey, '1', 'EX', tier.blockSeconds);
      }
      this.logger.warn(
        `Combined login block after ${fails} fails: ip=${ip} phone=${phone} for ${tier.blockSeconds}s`,
      );
    } catch (err: any) {
      this.logger.error(`recordCombinedFailedAttempt Redis error: ${err.message}`);
    }
  }

  async resetCombinedRateLimit(ip: string, phone: string): Promise<void> {
    const combinedKey = `rl:combined:${ip}:${phone}`;
    const blockKey = `rl:combined:block:${ip}:${phone}`;
    try {
      await this.redis.del(combinedKey, blockKey);
    } catch (err: any) {
      this.logger.error(`resetCombinedRateLimit Redis error: ${err.message}`);
    }
  }

  async resetLoginRateLimits(ip: string, phone: string): Promise<void> {
    await Promise.all([
      this.resetRateLimit(phone, RateLimitType.LOGIN),
      this.resetRateLimit(`ip:${ip}`, RateLimitType.LOGIN),
      this.resetCombinedRateLimit(ip, phone),
    ]);
  }
}
