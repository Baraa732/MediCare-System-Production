import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type CheckStatus = 'ok' | 'error' | 'unknown';
type ServiceStatus = 'up' | 'down';

export interface PlatformHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Array<{
    name: string;
    status: ServiceStatus;
    checks?: Record<string, string>;
  }>;
  infrastructure: {
    database: CheckStatus;
    kafka: CheckStatus;
    redis: CheckStatus;
  };
}

interface ServiceTarget {
  name: string;
  url: string;
}

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  private readonly serviceTargets: ServiceTarget[] = [
    {
      name: 'api-gateway',
      url: process.env.API_GATEWAY_URL || 'http://api-gateway:3000',
    },
    {
      name: 'auth-service',
      url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
    },
    {
      name: 'user-service',
      url: process.env.USER_SERVICE_URL || 'http://user-service:3002',
    },
    {
      name: 'system-manager-service',
      url: process.env.SELF_HEALTH_URL || 'http://localhost:3003',
    },
    {
      name: 'clinic-service',
      url: process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006',
    },
    {
      name: 'emr-service',
      url: process.env.EMR_SERVICE_URL || 'http://emr-service:3004',
    },
    {
      name: 'notification-service',
      url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009',
    },
  ];

  async getPlatformHealth(): Promise<PlatformHealthResponse> {
    const results = await Promise.all(
      this.serviceTargets.map((target) => this.probeService(target)),
    );

    const infrastructure = this.aggregateInfrastructure(results);
    const downCount = results.filter((r) => r.status === 'down').length;
    const status =
      downCount === 0
        ? 'healthy'
        : downCount === results.length
          ? 'unhealthy'
          : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: results,
      infrastructure,
    };
  }

  private async probeService(target: ServiceTarget): Promise<{
    name: string;
    status: ServiceStatus;
    checks?: Record<string, string>;
  }> {
    try {
      const res = await axios.get(`${target.url}/health/ready`, { timeout: 1500 });
      const checks = res.data?.checks as Record<string, string> | undefined;
      return {
        name: target.name,
        status: 'up',
        checks,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.checks) {
        return {
          name: target.name,
          status: 'down',
          checks: error.response.data.checks as Record<string, string>,
        };
      }

      this.logger.warn(`Health probe failed for ${target.name}: ${String(error)}`);
      return { name: target.name, status: 'down' };
    }
  }

  private aggregateInfrastructure(
    services: Array<{ name: string; status: ServiceStatus; checks?: Record<string, string> }>,
  ): PlatformHealthResponse['infrastructure'] {
    const auth = services.find((s) => s.name === 'auth-service');
    const checks = auth?.checks ?? {};

    return {
      database: this.normalizeCheck(checks.database),
      kafka: this.normalizeCheck(checks.kafka),
      redis: this.normalizeCheck(checks.redis),
    };
  }

  private normalizeCheck(value?: string): CheckStatus {
    if (value === 'ok') return 'ok';
    if (value === 'error') return 'error';
    return 'unknown';
  }
}
