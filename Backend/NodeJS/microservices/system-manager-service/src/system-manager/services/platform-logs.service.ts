import { Injectable, Logger } from '@nestjs/common';
import { LokiTelemetryService } from './loki-telemetry.service';
import { parseLogLine } from './log-line.parser';

type DockerClient = {
  getContainer(name: string): {
    logs(options: Record<string, unknown>): Promise<Buffer>;
  };
};

export type PlatformLogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface PlatformLogEntry {
  id: string;
  timestamp: string;
  level: PlatformLogLevel;
  service: string;
  message: string;
  raw: string;
  traceId?: string | null;
  spanId?: string | null;
  requestId?: string | null;
}

export interface PlatformLogsResponse {
  timestamp: string;
  enabled: boolean;
  source?: 'loki' | 'docker';
  warning?: string;
  entries: PlatformLogEntry[];
  services: Array<{ name: string; count: number }>;
  levels: Array<{ level: PlatformLogLevel; count: number }>;
  histogram: Array<{
    bucket: string;
    error: number;
    warn: number;
    info: number;
    debug: number;
    trace: number;
  }>;
}

export const SERVICE_CONTAINERS: Record<string, string> = {
  'api-gateway': 'api_gateway',
  'auth-service': 'auth_service',
  'user-service': 'user_service',
  'system-manager-service': 'system_manager_service',
  'clinic-service': 'clinic_service',
  'appointment-service': 'appointment_service',
  'scheduling-service': 'scheduling_service',
  'notification-service': 'notification_service',
  'emr-service': 'emr_service',
  'reminder-service': 'reminder_service',
};

const RANGE_SECONDS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
};

const LEVEL_ORDER: PlatformLogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

@Injectable()
export class PlatformLogsService {
  private readonly logger = new Logger(PlatformLogsService.name);
  private docker: DockerClient | null = null;

  constructor(private readonly lokiTelemetryService: LokiTelemetryService) {
    if (process.env.PLATFORM_LOGS_ENABLED === 'false') return;
    try {
      // CommonJS require avoids broken default export interop in compiled output.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Docker = require('dockerode') as new (options: { socketPath: string }) => DockerClient;
      this.docker = new Docker({
        socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
      });
    } catch (error) {
      this.logger.warn(`Docker client unavailable: ${String(error)}`);
    }
  }

  async getPlatformLogs(query: {
    services?: string[];
    levels?: PlatformLogLevel[];
    search?: string;
    range?: string;
    limit?: number;
  }): Promise<PlatformLogsResponse> {
    const rangeKey = query.range && RANGE_SECONDS[query.range] ? query.range : '1h';
    const lokiAvailable = await this.lokiTelemetryService.isAvailable();

    if (lokiAvailable) {
      const rows = await this.lokiTelemetryService.queryLogs({
        services: query.services,
        levels: query.levels,
        search: query.search,
        range: rangeKey,
        limit: query.limit,
      });
      let entries = rows.map((row, index) => this.lokiTelemetryService.toPlatformLogEntry(row, index));

      if (!entries.length) {
        const dockerResult = await this.fetchDockerLogs(query, rangeKey);
        if (dockerResult.entries.length) {
          return {
            ...dockerResult,
            source: 'docker',
            warning: dockerResult.warning ?? 'Loki returned no matching logs; showing Docker container logs.',
          };
        }
      }

      return {
        timestamp: new Date().toISOString(),
        enabled: true,
        source: 'loki',
        entries,
        services: this.countBy(entries, 'service', Object.keys(SERVICE_CONTAINERS)),
        levels: LEVEL_ORDER.map((level) => ({
          level,
          count: entries.filter((e) => e.level === level).length,
        })),
        histogram: this.buildHistogram(entries, RANGE_SECONDS[rangeKey]),
      };
    }

    return this.fetchDockerLogs(query, rangeKey);
  }

  private async fetchDockerLogs(
    query: {
      services?: string[];
      levels?: PlatformLogLevel[];
      search?: string;
      limit?: number;
    },
    rangeKey: string,
  ): Promise<PlatformLogsResponse> {
    const since = Math.floor(Date.now() / 1000) - RANGE_SECONDS[rangeKey];
    const perServiceTail = Math.min(Math.max(query.limit ?? 400, 50), 800);
    const serviceKeys = query.services?.length
      ? query.services.filter((s) => SERVICE_CONTAINERS[s])
      : Object.keys(SERVICE_CONTAINERS);

    if (!this.docker) {
      return this.emptyResponse('Docker socket is not available. Mount /var/run/docker.sock for platform logs.');
    }

    const chunks = await Promise.all(
      serviceKeys.map(async (service) => ({
        service,
        lines: await this.readContainerLogs(SERVICE_CONTAINERS[service], since, perServiceTail),
      })),
    );

    let entries: PlatformLogEntry[] = [];
    for (const chunk of chunks) {
      for (const raw of chunk.lines) {
        const parsed = this.parseLine(raw, chunk.service);
        if (parsed) entries.push(parsed);
      }
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (query.levels?.length) {
      const allowed = new Set(query.levels);
      entries = entries.filter((e) => allowed.has(e.level));
    }

    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      entries = entries.filter(
        (e) =>
          e.message.toLowerCase().includes(needle) ||
          e.service.toLowerCase().includes(needle) ||
          e.raw.toLowerCase().includes(needle),
      );
    }

    const maxEntries = Math.min(query.limit ?? 1000, 2000);
    entries = entries.slice(0, maxEntries);

    return {
      timestamp: new Date().toISOString(),
      enabled: true,
      source: 'docker',
      entries,
      services: this.countBy(entries, 'service', Object.keys(SERVICE_CONTAINERS)),
      levels: LEVEL_ORDER.map((level) => ({
        level,
        count: entries.filter((e) => e.level === level).length,
      })),
      histogram: this.buildHistogram(entries, RANGE_SECONDS[rangeKey]),
    };
  }

  getKnownServices(): string[] {
    return Object.keys(SERVICE_CONTAINERS);
  }

  private async readContainerLogs(
    containerName: string,
    since: number,
    tail: number,
  ): Promise<string[]> {
    if (!this.docker) return [];
    try {
      const container = this.docker.getContainer(containerName);
      const buffer = (await container.logs({
        stdout: true,
        stderr: true,
        timestamps: true,
        since,
        tail,
      })) as Buffer;

      return this.demuxDockerLogs(buffer);
    } catch (error) {
      this.logger.debug(`Could not read logs for ${containerName}: ${String(error)}`);
      return [];
    }
  }

  private demuxDockerLogs(buffer: Buffer): string[] {
    const lines: string[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) {
        const remainder = buffer.subarray(offset).toString('utf8').trim();
        if (remainder) lines.push(remainder);
        break;
      }

      const size = buffer.readUInt32BE(offset + 4);
      offset += 8;
      if (size <= 0 || offset + size > buffer.length) break;

      const chunk = buffer.subarray(offset, offset + size).toString('utf8').trim();
      if (chunk) lines.push(chunk);
      offset += size;
    }

    return lines;
  }

  private parseLine(raw: string, service: string): PlatformLogEntry | null {
    const parsed = parseLogLine(raw, service);
    if (!parsed) return null;
    const id = `${parsed.service}-${parsed.timestamp}-${parsed.message.slice(0, 40)}`.replace(/\s+/g, '_');
    return { id, ...parsed };
  }

  private countBy(
    entries: PlatformLogEntry[],
    key: 'service',
    defaults: string[] = [],
  ): Array<{ name: string; count: number }> {
    const map = new Map<string, number>();
    for (const name of defaults) {
      map.set(name, 0);
    }
    for (const entry of entries) {
      const name = entry[key];
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private buildHistogram(entries: PlatformLogEntry[], rangeSeconds: number) {
    const bucketCount = rangeSeconds <= 3600 ? 60 : 48;
    const bucketMs = (rangeSeconds * 1000) / bucketCount;
    const now = Date.now();
    const start = now - rangeSeconds * 1000;

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = start + i * bucketMs;
      return {
        bucket: new Date(bucketStart).toISOString(),
        error: 0,
        warn: 0,
        info: 0,
        debug: 0,
        trace: 0,
      };
    });

    for (const entry of entries) {
      const ts = new Date(entry.timestamp).getTime();
      if (Number.isNaN(ts) || ts < start || ts > now) continue;
      const index = Math.min(bucketCount - 1, Math.floor((ts - start) / bucketMs));
      const bucket = buckets[index];
      if (entry.level === 'ERROR') bucket.error += 1;
      else if (entry.level === 'WARN') bucket.warn += 1;
      else if (entry.level === 'DEBUG') bucket.debug += 1;
      else if (entry.level === 'TRACE') bucket.trace += 1;
      else bucket.info += 1;
    }

    return buckets;
  }

  private emptyResponse(warning: string): PlatformLogsResponse {
    return {
      timestamp: new Date().toISOString(),
      enabled: false,
      warning,
      entries: [],
      services: [],
      levels: [],
      histogram: [],
    };
  }
}
