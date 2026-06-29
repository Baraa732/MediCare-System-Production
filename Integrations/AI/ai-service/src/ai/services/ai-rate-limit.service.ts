import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getCorrelationId, hashRef } from '../security/secure-logging';

const INCR_WITH_TTL_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

interface MemoryWindow {
  count: number;
  windowStart: number;
}

@Injectable()
export class AiRateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRateLimitService.name);
  private redis: Redis | null = null;
  private readonly maxRequests: number;
  private readonly windowSeconds: number;
  private readonly memoryWindows = new Map<string, MemoryWindow>();

  constructor(private configService: ConfigService) {
    this.maxRequests = parseInt(
      this.configService.get<string>('AI_RATE_LIMIT_MAX') || '30',
      10,
    );
    this.windowSeconds = parseInt(
      this.configService.get<string>('AI_RATE_LIMIT_WINDOW_SECONDS') || '60',
      10,
    );
  }

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'rate_limit_redis_not_configured',
      });
      return;
    }

    this.redis = new Redis(redisUrl, {
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableOfflineQueue: false,
    });
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }

  async check(userId: string, tenantId?: string | null): Promise<void> {
    const scope = tenantId ? `tenant:${tenantId}` : 'platform';
    if (this.redis) {
      try {
        await this.checkRedis(userId, scope);
        return;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        this.logger.warn({
          correlationId: getCorrelationId(),
          reason: 'redis_unavailable_using_memory_fallback',
          userRef: hashRef(userId),
          tenantId: tenantId ?? 'platform',
        });
      }
    }

    try {
      this.checkMemory(userId, scope);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new ServiceUnavailableException('Rate limiting unavailable');
    }
  }

  private async checkRedis(userId: string, scope: string): Promise<void> {
    const key = `ai:rl:${scope}:${userId}`;
    const count = (await this.redis!.eval(
      INCR_WITH_TTL_SCRIPT,
      1,
      key,
      String(this.windowSeconds),
    )) as number;

    if (count > this.maxRequests) {
      const ttl = await this.redis!.ttl(key);
      throw new HttpException(
        {
          message: 'AI rate limit exceeded',
          retryAfter: ttl > 0 ? ttl : this.windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private checkMemory(userId: string, scope: string): void {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const memKey = `${scope}:${userId}`;
    const existing = this.memoryWindows.get(memKey);

    if (!existing || now - existing.windowStart >= windowMs) {
      this.memoryWindows.set(memKey, { count: 1, windowStart: now });
      return;
    }

    existing.count += 1;
    if (existing.count > this.maxRequests) {
      const retryAfter = Math.ceil((windowMs - (now - existing.windowStart)) / 1000);
      throw new HttpException(
        {
          message: 'AI rate limit exceeded',
          retryAfter: retryAfter > 0 ? retryAfter : this.windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
