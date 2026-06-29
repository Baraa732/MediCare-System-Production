import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { tenantRedisKey } from '../../tenant-shared/tenant.constants';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

@Injectable()
export class AiCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiCacheService.name);
  private redis: Redis | null = null;
  private readonly ttlSeconds: number;

  constructor(
    private configService: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.ttlSeconds = parseInt(
      this.configService.get<string>('AI_CACHE_TTL_SECONDS') || '3600',
      10,
    );
  }

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — AI response caching disabled');
      return;
    }

    this.redis = new Redis(redisUrl, {
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableOfflineQueue: false,
    });
    this.redis.on('connect', () => this.logger.log('AI cache Redis connected'));
    this.redis.on('error', (err) => this.logger.error(`AI cache Redis error: ${err.message}`));
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }

  private cacheKey(endpoint: string, input: string): string {
    const hash = createHash('sha256').update(`${endpoint}:${input}`).digest('hex');
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) {
      return tenantRedisKey(tenantId, 'ai-cache', hash);
    }
    return `ai:cache:platform:${hash}`;
  }

  async get<T>(endpoint: string, input: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.cacheKey(endpoint, input));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(endpoint: string, input: string, value: unknown): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        this.cacheKey(endpoint, input),
        JSON.stringify(value),
        'EX',
        this.ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`Cache write failed: ${(err as Error).message}`);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
