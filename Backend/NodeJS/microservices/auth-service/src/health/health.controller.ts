import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import Redis from 'ioredis';
import { isKafkaBrokerReachable } from '../kafka-shared/kafka-readiness.probe';

/**
 * Split health endpoints for Kubernetes probes:
 *
 * /health/live  — liveness probe: is the process alive?
 *   Returns 200 as long as the Node process is running and not deadlocked.
 *   Kubernetes restarts the pod if this fails.
 *   Does NOT check external dependencies — a DB outage should not restart the pod.
 *
 * /health/ready — readiness probe: can this pod accept traffic?
 *   Returns 200 only when DB + Redis + Kafka are all reachable.
 *   Kubernetes removes the pod from the load balancer if this fails.
 *   This prevents traffic from reaching a pod that cannot serve requests.
 *
 * /health       — legacy combined check (kept for backward compat with docker-compose)
 */
@Controller('health')
export class HealthController {
  private redis: Redis;

  constructor(
    @InjectDataSource('authConnection')
    private dataSource: DataSource,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://:redis_password@redis:6379', {
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 2000,
    });
  }

  // ── Liveness: process is alive ────────────────────────────────────────────
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
  }

  // ── Readiness: all dependencies reachable ─────────────────────────────────
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkKafka(),
    ]);

    const result = {
      database: checks[0].status === 'fulfilled' ? checks[0].value : 'error',
      redis:    checks[1].status === 'fulfilled' ? checks[1].value : 'error',
      kafka:    checks[2].status === 'fulfilled' ? checks[2].value : 'error',
    };

    const allOk = Object.values(result).every(v => v === 'ok');

    if (!allOk) {
      // Return 503 so Kubernetes removes this pod from the load balancer
      const res = { status: 'not_ready', service: 'auth-service', timestamp: new Date().toISOString(), checks: result };
      throw Object.assign(new Error('Service not ready'), { response: res, status: 503 });
    }

    return { status: 'ready', service: 'auth-service', timestamp: new Date().toISOString(), checks: result };
  }

  // ── Legacy combined (docker-compose healthcheck uses this) ────────────────
  @Get()
  async check() {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      await this.redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const allOk = Object.values(checks).every(v => v === 'ok');
    return {
      status: allOk ? 'ok' : 'degraded',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<string> {
    await this.dataSource.query('SELECT 1');
    return 'ok';
  }

  private async checkRedis(): Promise<string> {
    await this.redis.ping();
    return 'ok';
  }

  private async checkKafka(): Promise<string> {
    return (await isKafkaBrokerReachable()) ? 'ok' : 'error';
  }
}
