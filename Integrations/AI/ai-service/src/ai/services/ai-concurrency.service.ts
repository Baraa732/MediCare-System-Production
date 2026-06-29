import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

const ACQUIRE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0
end
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return count
`;

const RELEASE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 1 then
  redis.call('DEL', KEYS[1])
  return 0
end
return redis.call('DECR', KEYS[1])
`;

@Injectable()
export class AiConcurrencyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiConcurrencyService.name);
  private redis: Redis | null = null;
  private readonly maxConcurrent: number;
  private readonly slotTtlSeconds: number;
  private readonly memorySlots = new Map<string, number>();

  constructor(
    private configService: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.maxConcurrent = parseInt(
      this.configService.get<string>('AI_TENANT_MAX_CONCURRENT') || '5',
      10,
    );
    this.slotTtlSeconds = parseInt(
      this.configService.get<string>('AI_TENANT_CONCURRENCY_TTL_SECONDS') || '120',
      10,
    );
  }

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) return;
    this.redis = new Redis(redisUrl, {
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableOfflineQueue: false,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit();
  }

  async acquire(tenantId?: string | null): Promise<() => Promise<void>> {
    const id = tenantId ?? this.tenantContext.getTenantId() ?? 'platform';
    const key = `ai:conc:${id}`;

    if (this.redis) {
      try {
        const acquired = (await this.redis.eval(
          ACQUIRE_SCRIPT,
          1,
          key,
          String(this.maxConcurrent),
          String(this.slotTtlSeconds),
        )) as number;
        if (!acquired) {
          throw new ServiceUnavailableException('AI concurrency limit reached for tenant');
        }
        return async () => {
          await this.redis!.eval(RELEASE_SCRIPT, 1, key).catch(() => undefined);
        };
      } catch (err) {
        if (err instanceof ServiceUnavailableException) throw err;
        this.logger.warn(`AI concurrency Redis fallback for tenant ${id}`);
      }
    }

    const current = this.memorySlots.get(id) ?? 0;
    if (current >= this.maxConcurrent) {
      throw new ServiceUnavailableException('AI concurrency limit reached for tenant');
    }
    this.memorySlots.set(id, current + 1);
    return async () => {
      const n = this.memorySlots.get(id) ?? 1;
      if (n <= 1) this.memorySlots.delete(id);
      else this.memorySlots.set(id, n - 1);
    };
  }
}
