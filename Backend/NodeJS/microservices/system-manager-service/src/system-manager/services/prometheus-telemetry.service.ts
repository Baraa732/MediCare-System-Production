import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface PrometheusServiceMetrics {
  job: string;
  serviceName: string;
  reqRate: number;
  errorRate: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  cpuPercent: number | null;
  memoryBytes: number | null;
  series: number[];
  available: boolean;
}

const JOB_TO_SERVICE: Record<string, string> = {
  'api-gateway': 'api-gateway',
  'auth-service': 'auth-service',
  'user-service': 'user-service',
  'system-manager-service': 'system-manager-service',
};

@Injectable()
export class PrometheusTelemetryService {
  private readonly logger = new Logger(PrometheusTelemetryService.name);
  private readonly baseUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/-/ready`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  async queryInstant(promql: string): Promise<number | null> {
    try {
      const { data } = await axios.get(`${this.baseUrl}/api/v1/query`, {
        params: { query: promql },
        timeout: 4000,
      });
      const value = data?.data?.result?.[0]?.value?.[1];
      return value !== undefined ? Number(value) : null;
    } catch (error) {
      this.logger.debug(`Prometheus query failed: ${promql} — ${String(error)}`);
      return null;
    }
  }

  async queryRange(promql: string, rangeSeconds = 3600, step = 60): Promise<number[]> {
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - rangeSeconds;
      const { data } = await axios.get(`${this.baseUrl}/api/v1/query_range`, {
        params: { query: promql, start, end, step },
        timeout: 5000,
      });
      const values: Array<[number, string]> = data?.data?.result?.[0]?.values ?? [];
      return values.map(([, v]) => Math.round(Number(v) * 100) / 100);
    } catch {
      return [];
    }
  }

  async getServiceMetrics(range = '1h'): Promise<PrometheusServiceMetrics[]> {
    const rangeSeconds = range === '24h' ? 86400 : range === '7d' ? 604800 : 3600;
    const window = range === '24h' ? '1h' : '5m';
    const jobs = Object.keys(JOB_TO_SERVICE);

    return Promise.all(
      jobs.map(async (job) => {
        const serviceName = JOB_TO_SERVICE[job];
        const reqRate = await this.queryInstant(
          `sum(rate(http_requests_total{job="${job}"}[${window}]))`,
        );
        const errorRate = await this.queryInstant(
          `100 * sum(rate(http_requests_total{job="${job}",status=~"5.."}[${window}])) / clamp_min(sum(rate(http_requests_total{job="${job}"}[${window}])), 0.001)`,
        );
        const p50 = await this.queryInstant(
          `histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
        );
        const p95 = await this.queryInstant(
          `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
        );
        const p99 = await this.queryInstant(
          `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
        );
        const cpu = await this.queryInstant(
          `100 * rate(process_cpu_user_seconds_total{job="${job}"}[${window}])`,
        );
        const memory = await this.queryInstant(`process_resident_memory_bytes{job="${job}"}`);
        const series = await this.queryRange(
          `sum(rate(http_requests_total{job="${job}"}[5m]))`,
          Math.min(rangeSeconds, 3600),
          60,
        );

        const available = reqRate !== null || p95 !== null || cpu !== null;
        return {
          job,
          serviceName,
          reqRate: Math.round((reqRate ?? 0) * 100) / 100,
          errorRate: Math.round((errorRate ?? 0) * 10) / 10,
          p50: p50 !== null ? Math.round(p50) : null,
          p95: p95 !== null ? Math.round(p95) : null,
          p99: p99 !== null ? Math.round(p99) : null,
          cpuPercent: cpu !== null ? Math.round(cpu * 10) / 10 : null,
          memoryBytes: memory !== null ? Math.round(memory) : null,
          series: series.length ? series : [],
          available,
        };
      }),
    );
  }
}
