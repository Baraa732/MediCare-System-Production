import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { GatewayService } from '../gateway/gateway.service';

@Controller('health')
export class HealthController {
  constructor(private readonly gatewayService: GatewayService) {}

  // Liveness: gateway process is alive
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
  }

  // Readiness: required upstream services are reachable
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    const services = ['auth-service', 'user-service', 'system-manager-service'];
    // EMR is optional — only probe when EMR_SERVICE_URL is explicitly configured
    if (process.env.EMR_SERVICE_URL?.trim()) {
      services.push('emr-service');
    }
    const checks = await Promise.all(
      services.map(async (service) => ({
        service,
        ...(await this.gatewayService.healthCheck(service)),
      })),
    );

    const allUp = checks.every(c => c.status === 'UP');

    if (!allUp) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'api-gateway',
        services: checks,
      });
    }

    return {
      status: 'ready',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      services: checks,
    };
  }

  // Legacy combined (docker-compose healthcheck)
  @Get()
  async getHealth() {
    const services = ['auth-service', 'user-service', 'system-manager-service'];
    if (process.env.EMR_SERVICE_URL?.trim()) {
      services.push('emr-service');
    }
    const healthChecks = await Promise.all(
      services.map(async (service) => ({
        service,
        ...(await this.gatewayService.healthCheck(service)),
      })),
    );

    const allUp = healthChecks.every(check => check.status === 'UP');

    return {
      status: allUp ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      gateway: 'UP',
      services: healthChecks,
    };
  }
}
