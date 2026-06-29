import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { isKafkaBrokerReachable } from '../kafka-shared/kafka-readiness.probe';
import { OpenEmrClient } from '../emr/services/openemr.client';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private openEmrClient: OpenEmrClient,
  ) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'emr-service', timestamp: new Date().toISOString() };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return { status: 'ok', service: 'emr-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    checks.kafka = (await isKafkaBrokerReachable()) ? 'ok' : 'error';
    checks.openemr = (await this.openEmrClient.isReachable()) ? 'ok' : 'error';

    const allOk = Object.values(checks).every((v) => v === 'ok');
    if (!allOk) {
      throw Object.assign(new Error('Service not ready'), {
        response: { status: 'not_ready', service: 'emr-service', checks },
        status: 503,
      });
    }

    return { status: 'ready', service: 'emr-service', timestamp: new Date().toISOString(), checks };
  }
}
