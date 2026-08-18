import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { resolveRuntimeUrl } from './resolve-runtime-url';

type CheckStatus = 'ok' | 'error' | 'unknown';
type ServiceStatus = 'up' | 'down' | 'degraded';

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

const PROBE_TIMEOUT_MS = 4000;

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  private readonly serviceTargets: ServiceTarget[] = [
    {
      name: 'api-gateway',
      url: resolveRuntimeUrl({
        explicit: process.env.API_GATEWAY_URL,
        dockerFallback: 'http://api-gateway:3000',
        publicEnvKey: 'RAILWAY_SERVICE_MEDICARE_SYSTEM_PRODUCTION_URL',
        preferPublicOnRailway: true,
      }),
    },
    {
      name: 'auth-service',
      url: resolveRuntimeUrl({
        explicit: process.env.AUTH_SERVICE_URL,
        dockerFallback: 'http://auth-service:3001',
      }),
    },
    {
      name: 'user-service',
      url: resolveRuntimeUrl({
        explicit: process.env.USER_SERVICE_URL,
        dockerFallback: 'http://user-service:3002',
      }),
    },
    {
      name: 'system-manager-service',
      url: resolveRuntimeUrl({
        explicit: process.env.SELF_HEALTH_URL,
        dockerFallback: `http://localhost:${process.env.PORT || 3003}`,
      }),
    },
    {
      name: 'clinic-service',
      url: resolveRuntimeUrl({
        explicit: process.env.CLINIC_SERVICE_URL,
        dockerFallback: 'http://clinic-service:3006',
      }),
    },
    {
      name: 'emr-service',
      url: resolveRuntimeUrl({
        explicit: process.env.EMR_SERVICE_URL,
        dockerFallback: 'http://emr-service:3004',
      }),
    },
    {
      name: 'notification-service',
      url: resolveRuntimeUrl({
        explicit: process.env.NOTIFICATION_SERVICE_URL,
        dockerFallback: 'http://notification-service:3009',
      }),
    },
  ];

  async getPlatformHealth(): Promise<PlatformHealthResponse> {
    const results = await Promise.all(
      this.serviceTargets.map((target) => this.probeService(target)),
    );

    const infrastructure = this.aggregateInfrastructure(results);
    const downCount = results.filter((r) => r.status === 'down').length;
    const degradedCount = results.filter((r) => r.status === 'degraded').length;
    const status =
      downCount === results.length
        ? 'unhealthy'
        : downCount > 0 || degradedCount > 0
          ? 'degraded'
          : 'healthy';

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
    const live = await this.getJson(`${target.url}/health/live`);
    if (!live.ok) {
      this.logger.warn(`Health probe failed for ${target.name}: ${live.error}`);
      return { name: target.name, status: 'down' };
    }

    const ready = await this.getJson(`${target.url}/health/ready`);
    const checks = (ready.data?.checks ?? ready.data?.services)
      ? this.normalizeChecks(ready.data)
      : undefined;

    if (ready.ok) {
      return { name: target.name, status: 'up', checks };
    }

    return {
      name: target.name,
      status: 'degraded',
      checks: checks ?? { ready: 'error' },
    };
  }

  private async getJson(url: string): Promise<{
    ok: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const res = await axios.get(url, { timeout: PROBE_TIMEOUT_MS, validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, data: res.data as Record<string, unknown> };
      }
      return {
        ok: false,
        data: res.data as Record<string, unknown>,
        error: `HTTP ${res.status}`,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return {
          ok: false,
          data: error.response.data as Record<string, unknown>,
          error: this.stringifyAxiosError(error),
        };
      }
      return { ok: false, error: String(error) };
    }
  }

  private normalizeChecks(payload?: Record<string, unknown>): Record<string, string> | undefined {
    if (!payload) return undefined;
    if (payload.checks && typeof payload.checks === 'object') {
      return payload.checks as Record<string, string>;
    }
    if (Array.isArray(payload.services)) {
      return Object.fromEntries(
        payload.services.map((item) => {
          const row = item as { service?: string; status?: string };
          return [row.service ?? 'service', row.status ?? 'unknown'];
        }),
      );
    }
    return undefined;
  }

  private stringifyAxiosError(error: AxiosError): string {
    return error.code ? `${error.code} ${error.message}` : error.message;
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
