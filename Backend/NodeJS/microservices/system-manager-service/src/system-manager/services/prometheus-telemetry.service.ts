import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SERVICE_CONTAINERS } from './platform-logs.service';
import { resolvePrometheusBaseUrl } from './resolve-runtime-url';

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
  errorSeries: number[];
  timestamps: string[];
  available: boolean;
}

/** All known MediCare jobs — Prometheus job label matches service name. */
const JOBS = Object.keys(SERVICE_CONTAINERS);

@Injectable()
export class PrometheusTelemetryService {
  private readonly logger = new Logger(PrometheusTelemetryService.name);
  private readonly baseUrl = resolvePrometheusBaseUrl();

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
      if (value === undefined || value === null) return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    } catch (error) {
      this.logger.debug(`Prometheus query failed: ${promql} — ${String(error)}`);
      return null;
    }
  }

  async queryRange(
    promql: string,
    rangeSeconds = 3600,
    step = 60,
  ): Promise<{ values: number[]; timestamps: string[] }> {
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - rangeSeconds;
      const { data } = await axios.get(`${this.baseUrl}/api/v1/query_range`, {
        params: { query: promql, start, end, step },
        timeout: 6000,
      });
      const pairs: Array<[number, string]> = data?.data?.result?.[0]?.values ?? [];
      return {
        values: pairs.map(([, v]) => Math.round(Number(v) * 100) / 100),
        timestamps: pairs.map(([ts]) => new Date(ts * 1000).toISOString()),
      };
    } catch {
      return { values: [], timestamps: [] };
    }
  }

  async getServiceMetrics(range = '1h'): Promise<PrometheusServiceMetrics[]> {
    const rangeSeconds = range === '24h' ? 86400 : range === '6h' ? 21600 : range === '15m' ? 900 : 3600;
    const window = rangeSeconds >= 86400 ? '15m' : rangeSeconds >= 21600 ? '10m' : '5m';
    const step = rangeSeconds <= 900 ? 30 : rangeSeconds <= 3600 ? 60 : 300;

    return Promise.all(
      JOBS.map(async (job) => {
        const serviceName = job;
        const [reqRate, errorRate, p50, p95, p99, cpu, memory, seriesRange, errorRange] = await Promise.all([
          this.queryInstant(`sum(rate(http_requests_total{job="${job}"}[${window}]))`),
          this.queryInstant(
            `100 * sum(rate(http_requests_total{job="${job}",status=~"5.."}[${window}])) / clamp_min(sum(rate(http_requests_total{job="${job}"}[${window}])), 0.001)`,
          ),
          this.queryInstant(
            `histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
          ),
          this.queryInstant(
            `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
          ),
          this.queryInstant(
            `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
          ),
          this.queryInstant(`100 * rate(process_cpu_user_seconds_total{job="${job}"}[${window}])`),
          this.queryInstant(`process_resident_memory_bytes{job="${job}"}`),
          this.queryRange(`sum(rate(http_requests_total{job="${job}"}[5m]))`, rangeSeconds, step),
          this.queryRange(
            `sum(rate(http_requests_total{job="${job}",status=~"5.."}[5m]))`,
            rangeSeconds,
            step,
          ),
        ]);

        const available = reqRate !== null || p95 !== null || seriesRange.values.length > 0;
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
          series: seriesRange.values,
          errorSeries: errorRange.values,
          timestamps: seriesRange.timestamps.length ? seriesRange.timestamps : errorRange.timestamps,
          available,
        };
      }),
    );
  }
}
