import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { instrumentIoredisClient } from '@medicare/telemetry';
import { JwtBlocklistEntry } from '../entities/jwt-blocklist.entity';
import { tenantRedisKey } from '../../tenant-shared/tenant.constants';

@Injectable()
export class JwtBlocklistService {
  private readonly logger = new Logger(JwtBlocklistService.name);
  private redis: Redis;
  private readonly jwtTtlSeconds: number;

  constructor(
    private configService: ConfigService,
    @InjectRepository(JwtBlocklistEntry, 'authConnection')
    private jwtBlocklistRepository: Repository<JwtBlocklistEntry>,
  ) {
    this.redis = instrumentIoredisClient(
      new Redis(configService.get<string>('REDIS_URL') || 'redis://:redis_password@redis:6379', {
        lazyConnect: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
      }),
      'auth-service',
      'jwt-blocklist',
    ) as Redis;
    const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '15m';
    this.jwtTtlSeconds = this.parseExpiresIn(expiresIn);
  }

  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit] ?? 60);
  }

  /**
   * Pending MFA sessions are stored separately from the revocation blocklist.
   * Adding a brand-new mfa_pending jti to the blocklist made verify/resend treat it as revoked.
   */
  async storeMfaPendingSession(
    jti: string,
    ttlSeconds: number,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await this.redis.setex(`mfa:pending:meta:${jti}`, ttlSeconds, JSON.stringify(metadata));
    } catch (error: any) {
      this.logger.error(`Failed to store MFA pending session: ${error.message}`);
    }
  }

  async getMfaPendingSession(jti: string): Promise<Record<string, any> | null> {
    try {
      const metadata = await this.redis.get(`mfa:pending:meta:${jti}`);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error: any) {
      this.logger.error(`Failed to get MFA pending session: ${error.message}`);
      return null;
    }
  }

  async consumeMfaPendingSession(jti: string, revokeTtlSeconds = 300): Promise<void> {
    try {
      await this.redis.del(`mfa:pending:meta:${jti}`);
    } catch (error: any) {
      this.logger.error(`Failed to consume MFA pending session: ${error.message}`);
    }
    await this.addToBlocklist(jti, revokeTtlSeconds);
  }

  /**
   * Fix 5: Dual-write — add jti to both Redis (primary) and PostgreSQL (fallback).
   * This ensures revoked tokens remain rejected even during a Redis outage.
   * CRITICAL FIX: Added metadata parameter for MFA token ownership validation
   */
  async addToBlocklist(jti: string, ttlSeconds?: number, metadata?: Record<string, any>): Promise<void> {
    const ttl = ttlSeconds ?? this.jwtTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const tenantId = metadata?.tenantId as string | undefined;
    const blockKey = tenantId
      ? tenantRedisKey(tenantId, 'jwt-blocklist', jti)
      : `jwt:blocklist:${jti}`;
    const metaKey = tenantId
      ? tenantRedisKey(tenantId, 'jwt-blocklist-meta', jti)
      : `jwt:blocklist:meta:${jti}`;

    // Write to Redis (primary) — always keep legacy jti key for global revocation lookup
    try {
      await this.redis.setex(`jwt:blocklist:${jti}`, ttl, '1');
      if (tenantId) {
        await this.redis.setex(blockKey, ttl, '1');
      }
      if (metadata) {
        await this.redis.setex(`jwt:blocklist:meta:${jti}`, ttl, JSON.stringify(metadata));
        if (tenantId) {
          await this.redis.setex(metaKey, ttl, JSON.stringify(metadata));
        }
      }
      this.logger.debug(`JWT ${jti} added to Redis blocklist with TTL ${ttl}s`);
    } catch (error: any) {
      this.logger.error(`Failed to add JWT to Redis blocklist: ${error.message}`);
      // Don't throw — DB write below is the fallback
    }

    // Fix 5: Dual-write to DB — ensures revocation survives Redis outage
    try {
      await this.jwtBlocklistRepository
        .createQueryBuilder()
        .insert()
        .values({ jti, expiresAt })
        .orIgnore()
        .execute();
    } catch (error: any) {
      this.logger.error(`Failed to add JWT to DB blocklist: ${error.message}`);
    }
  }

  /**
   * Fix 5: Check revocation with DB fallback.
   * Redis unavailable → query PostgreSQL jwt_blocklist table.
   * Revoked tokens are ALWAYS rejected, even during Redis outages.
   */
  async isRevoked(jti: string): Promise<boolean> {
    try {
      const result = await this.redis.get(`jwt:blocklist:${jti}`);
      return result === '1';
    } catch (error: any) {
      // Fix 5: Redis unavailable — fall back to DB (fail CLOSED for security)
      this.logger.warn(`JWT blocklist Redis error — falling back to DB: ${error.message}`);
      return this.isRevokedFromDb(jti);
    }
  }

  /**
   * Fix 5: DB fallback for isRevoked when Redis is unavailable.
   * Ensures revoked tokens remain rejected during Redis outages.
   */
  private async isRevokedFromDb(jti: string): Promise<boolean> {
    try {
      const entry = await this.jwtBlocklistRepository
        .createQueryBuilder('b')
        .where('b.jti = :jti AND b.expires_at > NOW()', { jti })
        .getOne();
      return entry !== null;
    } catch (dbErr: any) {
      // Both Redis and DB failed — fail CLOSED (security > availability)
      this.logger.error(`JWT blocklist DB fallback also failed: ${dbErr.message}`);
      return true; // treat as revoked when we cannot verify
    }
  }

  /**
   * CRITICAL FIX: Get metadata for a JWT from Redis (for MFA token ownership validation)
   */
  async getMetadata(jti: string): Promise<Record<string, any> | null> {
    try {
      const metadata = await this.redis.get(`jwt:blocklist:meta:${jti}`);
      return metadata ? JSON.parse(metadata) : null;
    } catch (error: any) {
      this.logger.error(`Failed to get JWT metadata: ${error.message}`);
      return null;
    }
  }

  async removeFromBlocklist(jti: string): Promise<void> {
    try {
      await this.redis.del(`jwt:blocklist:${jti}`);
    } catch (error: any) {
      this.logger.error(`Failed to remove JWT from Redis blocklist: ${error.message}`);
    }
    try {
      await this.jwtBlocklistRepository.delete({ jti });
    } catch (error: any) {
      this.logger.error(`Failed to remove JWT from DB blocklist: ${error.message}`);
    }
  }

  /**
   * Fix 5 + 17: Cleanup expired entries from DB blocklist.
   * Called by CleanupTasks daily cron.
   */
  async cleanupExpired(): Promise<void> {
    try {
      const result = await this.jwtBlocklistRepository
        .createQueryBuilder()
        .delete()
        .where('expires_at < NOW()')
        .execute();
      this.logger.log(`Deleted ${result.affected} expired JWT blocklist entries`);
    } catch (error: any) {
      this.logger.error(`Failed to cleanup expired JWT blocklist entries: ${error.message}`);
    }
  }

  async clearBlocklist(): Promise<void> {
    try {
      const keys = await this.redis.keys('jwt:blocklist:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.warn(`Cleared ${keys.length} entries from Redis JWT blocklist`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to clear Redis JWT blocklist: ${error.message}`);
    }
  }
}
