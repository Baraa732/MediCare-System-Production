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

  private async queryQuantile(job: string, quantile: number, window: string): Promise<number | null> {
    const fromRate = await this.queryInstant(
      `histogram_quantile(${quantile}, sum(rate(http_request_duration_seconds_bucket{job="${job}"}[${window}])) by (le)) * 1000`,
    );
    if (fromRate !== null) return fromRate;
    return this.queryInstant(
      `histogram_quantile(${quantile}, sum(http_request_duration_seconds_bucket{job="${job}"}) by (le)) * 1000`,
    );
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
          this.queryQuantile(job, 0.5, window),
          this.queryQuantile(job, 0.95, window),
          this.queryQuantile(job, 0.99, window),
          this.queryInstant(
            `100 * (rate(process_cpu_user_seconds_total{job="${job}"}[${window}]) + rate(process_cpu_system_seconds_total{job="${job}"}[${window}]))`,
          ).then(async (v) => {
            if (v !== null) return v;
            return this.queryInstant(`100 * rate(process_cpu_seconds_total{job="${job}"}[${window}])`);
          }),
          this.queryInstant(`process_resident_memory_bytes{job="${job}"}`).then(async (v) => {
            if (v !== null) return v;
            return this.queryInstant(`nodejs_heap_size_used_bytes{job="${job}"}`);
          }),
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

  async getPlatformResources(window = '5m'): Promise<{
    cpuPercent: number | null;
    memoryBytes: number | null;
    heapUsedBytes: number | null;
  }> {
    const [cpuCombined, cpuUser, memory, heap] = await Promise.all([
      this.queryInstant(`100 * avg(rate(process_cpu_seconds_total[${window}]))`),
      this.queryInstant(
        `100 * avg(rate(process_cpu_user_seconds_total[${window}]) + rate(process_cpu_system_seconds_total[${window}]))`,
      ),
      this.queryInstant('sum(process_resident_memory_bytes)'),
      this.queryInstant('sum(nodejs_heap_size_used_bytes)'),
    ]);
    return {
      cpuPercent: cpuCombined ?? cpuUser,
      memoryBytes: memory,
      heapUsedBytes: heap,
    };
  }

  async queryInstantVector(
    promql: string,
  ): Promise<Array<{ labels: Record<string, string>; value: number }>> {
    try {
      const { data } = await axios.get(`${this.baseUrl}/api/v1/query`, {
        params: { query: promql },
        timeout: 4000,
      });
      const rows: Array<{ metric?: Record<string, string>; value?: [number, string] }> =
        data?.data?.result ?? [];
      return rows
        .map((row) => ({
          labels: row.metric ?? {},
          value: Number(row.value?.[1] ?? 0),
        }))
        .filter((row) => Number.isFinite(row.value));
    } catch (error) {
      this.logger.debug(`Prometheus vector query failed: ${promql} — ${String(error)}`);
      return [];
    }
  }

  async listFiringAlerts(): Promise<{
    available: boolean;
    timestamp: string;
    items: Array<{
      id: string;
      name: string;
      service: string;
      severity: 'critical' | 'high' | 'warning' | 'info';
      condition: string;
      value: string;
      source: 'prometheus';
      summary?: string;
    }>;
  }> {
    const available = await this.isAvailable();
    if (!available) {
      return { available: false, timestamp: new Date().toISOString(), items: [] };
    }

    const [ruleAlerts, downJobs, errorRatio, medicare5xx] = await Promise.all([
      this.queryInstantVector('ALERTS{alertstate="firing"}'),
      this.queryInstantVector('up == 0'),
      this.queryInstantVector(
        '(sum by (job) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (job) (rate(http_requests_total[5m]))) > 0.05',
      ),
      this.queryInstantVector(
        '(sum by (service) (rate(medicare_http_responses_total{status_class="5xx"}[5m])) / sum by (service) (rate(medicare_http_responses_total[5m]))) > 0.05',
      ),
    ]);

    const items: Array<{
      id: string;
      name: string;
      service: string;
      severity: 'critical' | 'high' | 'warning' | 'info';
      condition: string;
      value: string;
      source: 'prometheus';
      summary?: string;
    }> = [];
    const seen = new Set<string>();
    const push = (item: (typeof items)[number]) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    };

    for (const row of ruleAlerts) {
      const name = row.labels.alertname || 'PrometheusAlert';
      const service = row.labels.job || row.labels.service || row.labels.instance || 'platform';
      push({
        id: `prom-${name}-${service}`.replace(/[^a-zA-Z0-9._-]/g, '-'),
        name,
        service,
        severity: mapPromSeverity(row.labels.severity),
        condition: name,
        value: 'firing',
        source: 'prometheus',
        summary: row.labels.summary,
      });
    }

    for (const row of downJobs) {
      const service = row.labels.job || row.labels.instance || 'unknown';
      push({
        id: `prom-down-${service}`.replace(/[^a-zA-Z0-9._-]/g, '-'),
        name: `${service} is down`,
        service,
        severity: 'critical',
        condition: 'up == 0',
        value: '0',
        source: 'prometheus',
        summary: `${service} is not being scraped`,
      });
    }

    for (const row of [...errorRatio, ...medicare5xx]) {
      const service = row.labels.job || row.labels.service || 'unknown';
      const pct = Math.round(row.value * 1000) / 10;
      push({
        id: `prom-5xx-${service}`.replace(/[^a-zA-Z0-9._-]/g, '-'),
        name: `${service} 5xx rate`,
        service,
        severity: pct >= 10 ? 'critical' : 'high',
        condition: 'http_5xx_ratio > 5%',
        value: `${pct}%`,
        source: 'prometheus',
        summary: `HTTP 5xx ratio is ${pct}%`,
      });
    }

    return { available: true, timestamp: new Date().toISOString(), items };
  }
}

function mapPromSeverity(raw?: string): 'critical' | 'high' | 'warning' | 'info' {
  const value = (raw ?? '').toLowerCase();
  if (value === 'critical' || value === 'page' || value === 'error') return 'critical';
  if (value === 'high') return 'high';
  if (value === 'info' || value === 'none') return 'info';
  return 'warning';
}
