import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PlatformHealthService } from './platform-health.service';
import {
  PlatformLogEntry,
  PlatformLogsService,
  SERVICE_CONTAINERS,
} from './platform-logs.service';
import { PrometheusTelemetryService } from './prometheus-telemetry.service';
import { OtelTopologyService } from './otel-topology.service';
import { LokiTelemetryService } from './loki-telemetry.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveLokiBaseUrl } = require('@medicare/telemetry/loki-url') as {
  resolveLokiBaseUrl: () => string;
};

type ServiceStatus = 'healthy' | 'degraded' | 'down';
type TraceStatus = 'ok' | 'slow' | 'error';
type MonitorStatus = 'up' | 'degraded' | 'down';

interface ApmService {
  name: string;
  status: ServiceStatus;
  reqRate: number;
  errorRate: number;
  p50: number;
  p95: number | null;
  p99: number | null;
  instances: number;
  series: number[];
  errorSeries: number[];
  seriesTimestamps: string[];
  cpuPercent?: number | null;
  memoryBytes?: number | null;
}

interface OperationalTrace {
  id: string;
  traceId: string;
  rootService: string;
  rootOp: string;
  duration: number;
  spans: number;
  errors: number;
  status: TraceStatus;
  time: string;
  logs: PlatformLogEntry[];
}

interface PlatformMonitor {
  id: string;
  name: string;
  url: string;
  type: 'HTTP' | 'TCP';
  status: MonitorStatus;
  availability: number;
  avgDuration: number | null;
  lastCheck: string;
  frequency: string;
}

interface PlatformIntegration {
  name: string;
  category: string;
  status: 'connected' | 'error' | 'available';
  desc: string;
  url: string;
  latencyMs: number | null;
  checkedAt: string;
}

const FALLBACK_EDGES: Array<[string, string]> = [
  ['api-gateway', 'auth-service'],
  ['api-gateway', 'user-service'],
  ['api-gateway', 'system-manager-service'],
  ['api-gateway', 'clinic-service'],
  ['clinic-service', 'user-service'],
  ['system-manager-service', 'clinic-service'],
];

@Injectable()
export class PlatformObservabilityService {
  private overviewCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<PlatformObservabilityService['buildOverview']>> }>();
  /** Short TTL so the dashboard stays near real-time under live polling. */
  private readonly overviewCacheTtlMs = Number(process.env.PLATFORM_OVERVIEW_CACHE_MS || 8_000);
  private overviewInflight = new Map<string, Promise<Awaited<ReturnType<PlatformObservabilityService['buildOverview']>>>>();

  constructor(
    private readonly platformHealthService: PlatformHealthService,
    private readonly platformLogsService: PlatformLogsService,
    private readonly prometheusTelemetryService: PrometheusTelemetryService,
    private readonly otelTopologyService: OtelTopologyService,
    private readonly lokiTelemetryService: LokiTelemetryService,
  ) {}

  async getOverview(range = '1h') {
    const cacheKey = range || '1h';
    const cached = this.overviewCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const inflight = this.overviewInflight.get(cacheKey);
    if (inflight) return inflight;

    const pending = this.buildOverview(cacheKey)
      .then((value) => {
        this.overviewCache.set(cacheKey, {
          expiresAt: Date.now() + Math.max(5_000, this.overviewCacheTtlMs),
          value,
        });
        return value;
      })
      .finally(() => {
        this.overviewInflight.delete(cacheKey);
      });

    this.overviewInflight.set(cacheKey, pending);
    return pending;
  }

  private async buildOverview(range = '1h') {
    const [health, logs, prometheusAvailable, lokiAvailable, otelAvailable, promMetrics] = await Promise.all([
      this.platformHealthService.getPlatformHealth(),
      this.platformLogsService.getPlatformLogs({ range, limit: 300 }),
      this.prometheusTelemetryService.isAvailable(),
      this.lokiTelemetryService.isAvailable(),
      this.otelTopologyService.isAvailable(),
      this.prometheusTelemetryService.getServiceMetrics(range),
    ]);

    const services = this.platformLogsService.getKnownServices();
    const entries = logs.entries;
    const promByService = new Map(promMetrics.map((m) => [m.serviceName, m]));
    const apm = services.map((service) =>
      this.buildApmService(service, entries, health, promByService.get(service), range),
    );
    const distributedTraces = this.otelTopologyService.buildTracesFromLogs(entries);
    const traces = this.buildTraces(distributedTraces, entries);
    const monitors = this.buildMonitors(health, promMetrics);
    const discoveredEdges = this.otelTopologyService.discoverEdgesFromLogs(entries);
    const serviceMap = this.buildServiceMap(apm, discoveredEdges);

    return {
      timestamp: new Date().toISOString(),
      range,
      telemetrySources: {
        prometheus: prometheusAvailable,
        loki: lokiAvailable,
        otel: otelAvailable || discoveredEdges.length > 0,
      },
      apm: {
        services: apm,
        errors: this.buildErrors(entries),
        latencySeries: await this.buildLatencySeries(apm, promByService, range),
        throughput: this.buildPlatformThroughput(apm, range),
        serviceMap,
      },
      traces: {
        summary: {
          total: traces.length,
          errors: traces.filter((t) => t.status === 'error').length,
          avgDuration: this.average(traces.map((t) => t.duration)),
          throughput: Math.round(apm.reduce((sum, s) => sum + s.reqRate, 0) * 100) / 100,
        },
        items: traces,
      },
      monitors: {
        summary: {
          up: monitors.filter((m) => m.status === 'up').length,
          degraded: monitors.filter((m) => m.status === 'degraded').length,
          down: monitors.filter((m) => m.status === 'down').length,
        },
        items: monitors,
        statusPage: health.services.map((service) => ({
          name: service.name,
          status: service.status === 'up' ? 'operational' : 'outage',
        })),
      },
      integrations: await this.buildIntegrations(health),
    };
  }

  async getTraceById(traceId: string) {
    const jaegerTrace = await this.otelTopologyService.fetchTraceFromJaeger(traceId);
    if (jaegerTrace) return jaegerTrace;

    const logs = await this.platformLogsService.getPlatformLogs({ range: '24h', limit: 2000 });
    const match = this.otelTopologyService
      .buildTracesFromLogs(logs.entries)
      .find((trace) => trace.traceId === traceId);
    return match ?? null;
  }

  async getTraceForService(service: string, range = '1h') {
    const logs = await this.platformLogsService.getPlatformLogs({ range, limit: 2000, services: [service] });
    const traces = this.otelTopologyService.buildTracesFromLogs(logs.entries);
    return traces.find((t) => t.rootService === service) ?? traces[0] ?? null;
  }

  private buildApmService(
    service: string,
    entries: PlatformLogEntry[],
    health: Awaited<ReturnType<PlatformHealthService['getPlatformHealth']>>,
    prom?: Awaited<ReturnType<PrometheusTelemetryService['getServiceMetrics']>>[number],
    range = '1h',
  ): ApmService {
    const serviceEntries = entries.filter((entry) => entry.service === service);
    const errorCount = serviceEntries.filter((entry) => entry.level === 'ERROR').length;
    const healthStatus = health.services.find((item) => item.name === service)?.status;
    const durations = serviceEntries.map((entry) => this.extractDuration(entry.message)).filter((value) => value > 0);
    const logP50 = this.percentile(durations, 50) ?? (healthStatus === 'up' ? 45 : 1200);
    const logP95 = this.percentile(durations, 95) ?? (healthStatus === 'up' ? logP50 * 2 : null);
    const logP99 = this.percentile(durations, 99) ?? (logP95 ? logP95 * 1.4 : null);

    const useProm = prom?.available;
    const p50 = useProm && prom.p50 !== null ? prom.p50 : Math.round(logP50);
    const p95 = useProm && prom.p95 !== null ? prom.p95 : logP95 === null ? null : Math.round(logP95);
    const p99 = useProm && prom.p99 !== null ? prom.p99 : logP99 === null ? null : Math.round(logP99);

    const logBuckets = this.seriesFromEntries(serviceEntries, range);
    const errorBuckets = this.seriesFromEntries(
      serviceEntries.filter((e) => e.level === 'ERROR' || e.level === 'WARN'),
      range,
    );
    const rangeSeconds = this.rangeSeconds(range);
    const logReqRate = rangeSeconds > 0
      ? Math.round((serviceEntries.length / rangeSeconds) * 100) / 100
      : 0;

    const reqRate = useProm ? prom.reqRate : logReqRate;
    const errorRate = useProm
      ? prom.errorRate
      : serviceEntries.length
        ? Number(((errorCount / serviceEntries.length) * 100).toFixed(1))
        : 0;

    return {
      name: service,
      status: healthStatus === 'down' ? 'down' : errorCount > 0 || (useProm && prom.errorRate > 2) ? 'degraded' : 'healthy',
      reqRate,
      errorRate,
      p50,
      p95,
      p99,
      instances: SERVICE_CONTAINERS[service] ? 1 : 0,
      series: useProm && prom.series.length ? prom.series : logBuckets.values,
      errorSeries: useProm && prom.errorSeries?.length ? prom.errorSeries : errorBuckets.values,
      seriesTimestamps: useProm && prom.timestamps?.length ? prom.timestamps : logBuckets.timestamps,
      cpuPercent: prom?.cpuPercent ?? null,
      memoryBytes: prom?.memoryBytes ?? null,
    };
  }

  private buildPlatformThroughput(apm: ApmService[], range: string) {
    const timestamps = apm.find((s) => s.seriesTimestamps.length)?.seriesTimestamps
      ?? this.seriesFromEntries([], range).timestamps;
    const maxLen = Math.max(timestamps.length, ...apm.map((s) => s.series.length));
    const total = Array.from({ length: maxLen }, (_, i) =>
      Math.round(apm.reduce((sum, s) => sum + (s.series[i] ?? 0), 0) * 100) / 100,
    );
    const errors = Array.from({ length: maxLen }, (_, i) =>
      Math.round(apm.reduce((sum, s) => sum + (s.errorSeries[i] ?? 0), 0) * 100) / 100,
    );
    const current = total[total.length - 1] ?? 0;
    const peak = total.reduce((best, v) => (v > best ? v : best), 0);
    const avg = total.length ? Math.round((total.reduce((a, b) => a + b, 0) / total.length) * 100) / 100 : 0;

    return {
      timestamps,
      total,
      errors,
      current,
      peak,
      avg,
      unit: 'req/s',
      source: apm.some((s) => s.series.length && s.seriesTimestamps.length) ? 'live' : 'empty',
    };
  }

  private rangeSeconds(range: string): number {
    if (range === '15m') return 15 * 60;
    if (range === '6h') return 6 * 60 * 60;
    if (range === '24h') return 24 * 60 * 60;
    return 60 * 60;
  }

  private buildTraces(
    distributed: ReturnType<OtelTopologyService['buildTracesFromLogs']>,
    entries: PlatformLogEntry[],
  ): OperationalTrace[] {
    if (distributed.length) {
      return distributed.map((trace) => ({
        id: trace.traceId,
        traceId: trace.traceId,
        rootService: trace.rootService,
        rootOp: trace.spans[0]?.operation ?? 'distributed trace',
        duration: trace.durationMs,
        spans: trace.spans.length,
        errors: trace.spans.filter((s) => s.status === 'error').length,
        status: trace.status,
        time: new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        logs: entries.filter((e) => e.traceId === trace.traceId).slice(0, 20),
      }));
    }

    return entries.slice(0, 120).map((entry) => {
      const duration = this.extractDuration(entry.message) || (entry.level === 'ERROR' ? 1200 : entry.level === 'WARN' ? 450 : 80);
      const status: TraceStatus = entry.level === 'ERROR' ? 'error' : duration > 1000 ? 'slow' : 'ok';
      const traceId = entry.traceId ?? this.hash(`${entry.service}-${entry.timestamp}-${entry.raw}`);

      return {
        id: traceId,
        traceId,
        rootService: entry.service,
        rootOp: this.operationFromMessage(entry.message),
        duration,
        spans: entry.level === 'ERROR' ? 3 : entry.level === 'WARN' ? 2 : 1,
        errors: entry.level === 'ERROR' ? 1 : 0,
        status,
        time: new Date(entry.timestamp).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        logs: [entry],
      };
    });
  }

  private buildMonitors(
    health: Awaited<ReturnType<PlatformHealthService['getPlatformHealth']>>,
    promMetrics: Awaited<ReturnType<PrometheusTelemetryService['getServiceMetrics']>>,
  ): PlatformMonitor[] {
    const promByJob = new Map(promMetrics.map((m) => [m.serviceName, m]));

    const serviceMonitors = health.services.map((service) => {
      const prom = promByJob.get(service.name);
      const availability = prom?.available
        ? Math.max(0, Math.min(100, 100 - (prom.errorRate ?? 0)))
        : service.status === 'up'
          ? 100
          : 0;
      return {
        id: `svc-${service.name}`,
        name: `${this.toTitle(service.name)} Health`,
        url: `/health/ready`,
        type: 'HTTP' as const,
        status: service.status === 'up' ? 'up' as const : 'down' as const,
        availability: Math.round(availability * 10) / 10,
        avgDuration: prom?.p95 ?? (service.status === 'up' ? 45 : null),
        lastCheck: 'just now',
        frequency: '30s',
      };
    });

    const infrastructure = Object.entries(health.infrastructure).map(([name, status]) => ({
      id: `infra-${name}`,
      name: `${this.toTitle(name)} Check`,
      url: name === 'database' ? 'postgres:5432' : name === 'redis' ? 'redis:6379' : 'kafka-1:9092',
      type: 'TCP' as const,
      status: status === 'ok' ? 'up' as const : status === 'unknown' ? 'degraded' as const : 'down' as const,
      availability: status === 'ok' ? 100 : status === 'unknown' ? 98 : 0,
      avgDuration: status === 'ok' ? 12 : null,
      lastCheck: 'just now',
      frequency: '30s',
    }));

    return [...serviceMonitors, ...infrastructure];
  }

  private async buildIntegrations(
    health: Awaited<ReturnType<PlatformHealthService['getPlatformHealth']>>,
  ): Promise<PlatformIntegration[]> {
    const checkedAt = new Date().toISOString();
    const [prometheus, grafana, loki, jaeger, evolution] = await Promise.all([
      this.probeIntegration('Prometheus', 'Data Sources', 'Metrics collection and alerting', process.env.PROMETHEUS_URL || 'http://prometheus:9090/-/ready'),
      this.probeIntegration('Grafana', 'Data Sources', 'Metrics dashboards and visualization', process.env.GRAFANA_INTERNAL_URL || 'http://grafana:3000/api/health'),
      this.probeIntegration('Loki', 'Data Sources', 'Structured log aggregation', `${resolveLokiBaseUrl()}/ready`),
      this.probeIntegration('Jaeger', 'Tracing', 'Distributed trace visualization', `${process.env.JAEGER_QUERY_URL || 'http://jaeger:16686'}/api/services`),
      this.probeEvolutionApi(),
    ]);
    const emrService = health.services.find((service) => service.name === 'emr-service');

    return [
      prometheus,
      grafana,
      loki,
      jaeger,
      {
        name: 'OpenEMR',
        category: 'Clinical',
        desc: 'Electronic medical records integration',
        url: process.env.EMR_SERVICE_URL || 'http://emr-service:3004/health/ready',
        status: this.checkIsOk(emrService?.checks?.openemr) && emrService?.status === 'up' ? 'connected' : 'error',
        latencyMs: emrService?.status === 'up' ? 45 : null,
        checkedAt,
      },
      evolution,
    ];
  }

  private async probeIntegration(
    name: string,
    category: string,
    desc: string,
    url: string,
    headers?: Record<string, string>,
  ): Promise<PlatformIntegration> {
    const started = Date.now();
    try {
      await axios.get(url, { timeout: 1500, headers });
      return { name, category, desc, url, status: 'connected', latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
    } catch {
      return { name, category, desc, url, status: 'error', latencyMs: null, checkedAt: new Date().toISOString() };
    }
  }

  private probeEvolutionApi(): Promise<PlatformIntegration> {
    const baseUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl.replace(/\/$/, '')}/instance/fetchInstances`;
    return this.probeIntegration(
      'Evolution API',
      'Messaging',
      'WhatsApp messaging integration',
      url,
      apiKey ? { apikey: apiKey } : undefined,
    );
  }

  private checkIsOk(value?: string): boolean {
    return value === 'ok' || value === 'healthy' || value === 'up';
  }

  private buildErrors(entries: PlatformLogEntry[]) {
    const grouped = new Map<string, { message: string; service: string; count: number; lastSeen: string; traceId: string | null }>();
    for (const entry of entries.filter((item) => item.level === 'ERROR' || item.level === 'WARN')) {
      const message = this.operationFromMessage(entry.message);
      const key = `${entry.service}:${message}`;
      const current = grouped.get(key) ?? {
        message,
        service: entry.service,
        count: 0,
        lastSeen: entry.timestamp,
        traceId: entry.traceId ?? null,
      };
      current.count += 1;
      if (entry.timestamp > current.lastSeen) {
        current.lastSeen = entry.timestamp;
        if (entry.traceId) current.traceId = entry.traceId;
      }
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((item, index) => ({
        id: index + 1,
        message: item.message,
        service: item.service,
        count: item.count,
        traceId: item.traceId,
        users: null,
        firstSeen: 'current range',
        lastSeen: new Date(item.lastSeen).toLocaleTimeString(),
      }));
  }

  private async buildLatencySeries(
    services: ApmService[],
    promByService: Map<string, Awaited<ReturnType<PrometheusTelemetryService['getServiceMetrics']>>[number]>,
    range: string,
  ) {
    const rangeSeconds = range === '24h' ? 86400 : range === '7d' ? 604800 : 3600;
    const window = range === '24h' ? '1h' : '5m';

    return Promise.all(
      services.slice(0, 8).map(async (service) => {
        const prom = promByService.get(service.name);
        if (prom?.available) {
          const [p50Series, p95Series] = await Promise.all([
            this.prometheusTelemetryService.queryRange(
              `histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{job="${service.name}"}[${window}])) by (le)) * 1000`,
              Math.min(rangeSeconds, 3600),
              60,
            ),
            this.prometheusTelemetryService.queryRange(
              `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="${service.name}"}[${window}])) by (le)) * 1000`,
              Math.min(rangeSeconds, 3600),
              60,
            ),
          ]);
          if (p50Series.values.length || p95Series.values.length) {
            return {
              name: service.name,
              p50: p50Series.values.length ? p50Series.values : this.expandSeries(service.p50, 60),
              p95: p95Series.values.length ? p95Series.values : this.expandSeries(service.p95 ?? service.p50 * 2, 60),
            };
          }
        }
        return {
          name: service.name,
          p50: this.expandSeries(service.p50, 60),
          p95: this.expandSeries(service.p95 ?? service.p50 * 2, 60),
        };
      }),
    );
  }

  private buildServiceMap(
    services: ApmService[],
    discoveredEdges: ReturnType<OtelTopologyService['discoverEdgesFromLogs']>,
  ) {
    const { edges, simulated } = this.otelTopologyService.buildServiceMapEdges(
      discoveredEdges,
      FALLBACK_EDGES,
      services.map((s) => s.name),
    );

    return {
      simulated,
      nodes: services.map((service) => ({
        id: service.name,
        name: service.name,
        status: service.status,
        reqRate: service.reqRate,
        errorRate: service.errorRate,
      })),
      edges,
    };
  }

  private seriesFromEntries(
    entries: PlatformLogEntry[],
    range = '1h',
  ): { values: number[]; timestamps: string[] } {
    const rangeSeconds = this.rangeSeconds(range);
    const bucketCount = rangeSeconds <= 900 ? 30 : rangeSeconds <= 3600 ? 60 : 48;
    const now = Date.now();
    const windowMs = rangeSeconds * 1000;
    const bucketMs = windowMs / bucketCount;
    const buckets = Array.from({ length: bucketCount }, () => 0);
    const timestamps = Array.from({ length: bucketCount }, (_, i) =>
      new Date(now - windowMs + i * bucketMs).toISOString(),
    );

    for (const entry of entries) {
      const ts = new Date(entry.timestamp).getTime();
      if (Number.isNaN(ts) || ts < now - windowMs || ts > now) continue;
      buckets[Math.min(bucketCount - 1, Math.floor((ts - (now - windowMs)) / bucketMs))] += 1;
    }

    // Convert event counts → approximate req/s for the bucket.
    const bucketSeconds = bucketMs / 1000;
    const values = buckets.map((count) => Math.round((count / bucketSeconds) * 100) / 100);
    return { values, timestamps };
  }

  /** Flat series from a real scalar — no synthetic sine waves. */
  private expandSeries(base: number, points: number): number[] {
    const value = Math.max(0, Math.round(base));
    return Array.from({ length: points }, () => value);
  }

  private extractDuration(message: string): number {
    const match = message.match(/(\d+(?:\.\d+)?)\s*ms\b/i) ?? message.match(/(\d+(?:\.\d+)?)\s*s\b/i);
    if (!match) return 0;
    const value = Number(match[1]);
    return /s\b/i.test(match[0]) ? Math.round(value * 1000) : Math.round(value);
  }

  private operationFromMessage(message: string): string {
    return message
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'service event';
  }

  private percentile(values: number[], p: number): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private hash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private toTitle(value: string): string {
    return value
      .split(/[-_]/g)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
