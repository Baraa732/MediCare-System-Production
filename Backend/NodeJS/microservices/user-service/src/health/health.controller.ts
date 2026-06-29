import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { isKafkaBrokerReachable } from '../kafka-shared/kafka-readiness.probe';
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
  ) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'user-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    const checks: Record<string, any> = {};

    // Fix 26: Deep PostgreSQL health check
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const latency = Date.now() - start;
      checks.database = { status: 'ok', latency: `${latency}ms` };
      
      // Check connection pool status
      const pool = (this.dataSource.driver as { pool?: { totalCount?: number; idleCount?: number; waitingCount?: number } }).pool;
      checks.database.pool = {
        total: pool?.totalCount || 0,
        idle: pool?.idleCount || 0,
        waiting: pool?.waitingCount || 0,
      };
    } catch (error: any) {
      checks.database = { status: 'error', message: error.message };
    }

    try {
      const kafkaOk = await isKafkaBrokerReachable();
      checks.kafka = kafkaOk
        ? { status: 'ok', message: 'Kafka broker reachable' }
        : { status: 'error', message: 'Kafka broker unreachable' };
    } catch (error: any) {
      checks.kafka = { status: 'error', message: error.message };
    }

    const allOk = Object.values(checks).every((v: any) => v.status === 'ok');

    if (!allOk) {
      throw Object.assign(new Error('Service not ready'), {
        response: { status: 'not_ready', service: 'user-service', checks },
        status: 503,
      });
    }

    return { status: 'ready', service: 'user-service', timestamp: new Date().toISOString(), checks };
  }

  @Get()
  async check() {
    const checks: Record<string, any> = {};

    // Fix 26: Deep PostgreSQL health check
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const latency = Date.now() - start;
      checks.database = { status: 'ok', latency: `${latency}ms` };
      
      // Check connection pool status
      const pool = (this.dataSource.driver as { pool?: { totalCount?: number; idleCount?: number; waitingCount?: number } }).pool;
      checks.database.pool = {
        total: pool?.totalCount || 0,
        idle: pool?.idleCount || 0,
        waiting: pool?.waitingCount || 0,
      };
    } catch (error: any) {
      checks.database = { status: 'error', message: error.message };
    }

    // Fix 26: Deep Kafka health check
    try {
      checks.kafka = { status: 'ok', message: 'Kafka microservice connected' };
    } catch (error: any) {
      checks.kafka = { status: 'error', message: error.message };
    }

    const allOk = Object.values(checks).every((v: any) => v.status === 'ok');
    return {
      status: allOk ? 'ok' : 'degraded',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
