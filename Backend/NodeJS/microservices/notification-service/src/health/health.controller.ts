import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { isKafkaBrokerReachable } from '../kafka-shared/kafka-readiness.probe';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }
    checks.kafka = (await isKafkaBrokerReachable()) ? 'ok' : 'error';
    const allOk = Object.values(checks).every((v) => v === 'ok');
    if (!allOk) {
      throw Object.assign(new Error('Service not ready'), {
        response: { status: 'not_ready', service: 'notification-service', checks },
        status: 503,
      });
    }
    return { status: 'ready', service: 'notification-service', timestamp: new Date().toISOString(), checks };
  }
}
