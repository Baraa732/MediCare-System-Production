import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isKafkaBrokerReachable } from '../kafka-shared/kafka-readiness.probe';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'scheduling-service' };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    try {
      await this.db.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }
    checks.kafka = (await isKafkaBrokerReachable()) ? 'ok' : 'error';
    if (Object.values(checks).some((v) => v !== 'ok')) {
      throw Object.assign(new Error('not ready'), { status: 503 });
    }
    return { status: 'ready', service: 'scheduling-service', checks };
  }
}
