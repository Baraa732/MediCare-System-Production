import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

interface CachedValidation {
  userId: string;
  role: string;
  sessionId: string;
  expiresAt: number;
}

@Injectable()
export class JwtCacheService {
  private readonly logger = new Logger(JwtCacheService.name);
  private redisClient: RedisClientType;
  private cacheEnabled: boolean;
  private cacheTTL: number; // seconds

  constructor(private configService: ConfigService) {
    this.cacheEnabled = this.configService.get('JWT_CACHE_ENABLED') !== 'false';
    this.cacheTTL = parseInt(this.configService.get('JWT_CACHE_TTL') || '300', 10); // 5 minutes default
    
    if (this.cacheEnabled) {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      this.redisClient = createClient(
        redisUrl
          ? { url: redisUrl }
          : {
              socket: {
                host: this.configService.get('REDIS_HOST') || 'redis',
                port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
              },
              username:
                this.configService.get('REDIS_USERNAME') ||
                this.configService.get('REDISUSER'),
              password: this.configService.get('REDIS_PASSWORD'),
            },
      );

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis cache error:', err);
      });

      this.redisClient.connect().catch((err) => {
        this.logger.error('Failed to connect to Redis for JWT cache:', err);
        this.cacheEnabled = false;
      });
    }
  }

  async get(token: string): Promise<CachedValidation | null> {
    if (!this.cacheEnabled || !this.redisClient) {
      return null;
    }

    try {
      const key = this.getCacheKey(token);
      const data = await this.redisClient.get(key);
      
      if (data) {
        const cached: CachedValidation = JSON.parse(data);
        // Check if cache entry is expired
        if (cached.expiresAt > Date.now()) {
          this.logger.debug(`JWT cache hit for token: ${token.substring(0, 20)}...`);
          return cached;
        } else {
          // Remove expired entry
          await this.redisClient.del(key);
        }
      }
    } catch (error) {
      this.logger.error('Error reading from JWT cache:', error);
    }

    return null;
  }

  async set(token: string, validation: CachedValidation): Promise<void> {
    if (!this.cacheEnabled || !this.redisClient) {
      return;
    }

    try {
      const key = this.getCacheKey(token);
      const value = JSON.stringify(validation);
      
      await this.redisClient.setEx(key, this.cacheTTL, value);
      this.logger.debug(`JWT cache set for token: ${token.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error('Error writing to JWT cache:', error);
    }
  }

  async invalidate(token: string): Promise<void> {
    if (!this.cacheEnabled || !this.redisClient) {
      return;
    }

    try {
      const key = this.getCacheKey(token);
      await this.redisClient.del(key);
      this.logger.debug(`JWT cache invalidated for token: ${token.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error('Error invalidating JWT cache:', error);
    }
  }

  async invalidateByUserId(userId: string): Promise<void> {
    if (!this.cacheEnabled || !this.redisClient) {
      return;
    }

    try {
      // Scan for all keys matching the pattern and delete them
      const pattern = 'jwt:*';
      const keys = [];
      
      for await (const key of this.redisClient.scanIterator({ MATCH: pattern })) {
        const data = await this.redisClient.get(key);
        if (data) {
          const cached: CachedValidation = JSON.parse(data);
          if (cached.userId === userId) {
            await this.redisClient.del(key);
            keys.push(key);
          }
        }
      }
      
      this.logger.debug(`Invalidated ${keys.length} JWT cache entries for user: ${userId}`);
    } catch (error) {
      this.logger.error('Error invalidating JWT cache by user ID:', error);
    }
  }

  private getCacheKey(token: string): string {
    // Use SHA-256 hash of token as cache key to avoid storing sensitive data
    const crypto = require('crypto');
    return `jwt:${crypto.createHash('sha256').update(token).digest('hex')}`;
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}
