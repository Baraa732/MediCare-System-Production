import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { instrumentIoredisClient } from '@medicare/telemetry';

/**
 * Redis-backed Circuit Breaker Service
 * 
 * Provides distributed circuit breaking using Redis for state storage.
 * This allows multiple instances of the same service to share circuit state,
 * preventing cascading failures in a distributed system.
 * 
 * States:
 * - CLOSED: Requests pass normally. Failure count increments on errors.
 * - OPEN: Requests fail immediately. After timeout, transitions to HALF_OPEN.
 * - HALF_OPEN: One request allowed to probe. Success resets to CLOSED, failure returns to OPEN.
 */
@Injectable()
export class RedisCircuitBreakerService {
  private readonly logger = new Logger(RedisCircuitBreakerService.name);
  private redis: Redis;

  constructor() {
    this.redis = instrumentIoredisClient(
      new Redis(process.env.REDIS_URL || 'redis://:redis_password@redis:6379', {
        lazyConnect: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
      }),
      'auth-service',
      'circuit-breaker',
    ) as Redis;
  }

  /**
   * Check if the circuit is open for a given service/key
   * @param key - Circuit breaker key (e.g., 'user-service', 'kafka-producer')
   * @returns true if circuit is open (requests should fail fast)
   */
  async isOpen(key: string): Promise<boolean> {
    try {
      const state = await this.redis.get(`circuit:${key}:state`);
      return state === 'OPEN';
    } catch (error: any) {
      this.logger.error(`Failed to check circuit state for ${key}: ${error.message}`);
      // Fail closed - if Redis is down, allow requests
      return false;
    }
  }

  /**
   * Record a successful request for a circuit
   * @param key - Circuit breaker key
   */
  async recordSuccess(key: string): Promise<void> {
    try {
      const state = await this.redis.get(`circuit:${key}:state`);
      
      if (state === 'OPEN') {
        // If we're in HALF_OPEN and got success, close the circuit
        await this.redis.set(`circuit:${key}:state`, 'CLOSED');
        await this.redis.del(`circuit:${key}:failures`);
        this.logger.log(`Circuit ${key} closed after successful probe`);
      } else if (state === 'HALF_OPEN') {
        // Reset to CLOSED
        await this.redis.set(`circuit:${key}:state`, 'CLOSED');
        await this.redis.del(`circuit:${key}:failures`);
        this.logger.log(`Circuit ${key} closed after successful probe`);
      } else {
        // Reset failure count on success in CLOSED state
        await this.redis.del(`circuit:${key}:failures`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to record success for ${key}: ${error.message}`);
    }
  }

  /**
   * Record a failed request for a circuit
   * @param key - Circuit breaker key
   * @param threshold - Failure threshold before opening circuit (default: 5)
   * @param timeoutMs - How long to stay open before attempting recovery (default: 30000ms)
   */
  async recordFailure(key: string, threshold: number = 5, timeoutMs: number = 30000): Promise<void> {
    try {
      const failures = await this.redis.incr(`circuit:${key}:failures`);
      
      // Set expiry on failure count (reset after timeout)
      await this.redis.expire(`circuit:${key}:failures`, timeoutMs / 1000);
      
      if (failures >= threshold) {
        await this.redis.set(`circuit:${key}:state`, 'OPEN');
        await this.redis.expire(`circuit:${key}:state`, timeoutMs / 1000);
        this.logger.warn(`Circuit ${key} opened after ${failures} failures`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to record failure for ${key}: ${error.message}`);
    }
  }

  /**
   * Attempt to transition from OPEN to HALF_OPEN
   * @param key - Circuit breaker key
   * @returns true if transitioned to HALF_OPEN, false if still OPEN
   */
  async attemptHalfOpen(key: string): Promise<boolean> {
    try {
      const state = await this.redis.get(`circuit:${key}:state`);
      if (state === 'OPEN') {
        // Check if the timeout has expired
        const ttl = await this.redis.ttl(`circuit:${key}:state`);
        if (ttl === -2) { // Key doesn't exist (expired)
          await this.redis.set(`circuit:${key}:state`, 'HALF_OPEN');
          this.logger.log(`Circuit ${key} transitioned to HALF_OPEN`);
          return true;
        }
      }
      return false;
    } catch (error: any) {
      this.logger.error(`Failed to attempt half-open for ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Reset a circuit to CLOSED state (for manual recovery)
   * @param key - Circuit breaker key
   */
  async reset(key: string): Promise<void> {
    try {
      await this.redis.set(`circuit:${key}:state`, 'CLOSED');
      await this.redis.del(`circuit:${key}:failures`);
      this.logger.log(`Circuit ${key} manually reset to CLOSED`);
    } catch (error: any) {
      this.logger.error(`Failed to reset circuit ${key}: ${error.message}`);
    }
  }

  /**
   * Get circuit state for monitoring
   * @param key - Circuit breaker key
   */
  async getState(key: string): Promise<{ state: string; failures: number }> {
    try {
      const state = await this.redis.get(`circuit:${key}:state`) || 'CLOSED';
      const failures = parseInt(await this.redis.get(`circuit:${key}:failures`) || '0', 10);
      return { state, failures };
    } catch (error: any) {
      this.logger.error(`Failed to get circuit state for ${key}: ${error.message}`);
      return { state: 'UNKNOWN', failures: 0 };
    }
  }
}
