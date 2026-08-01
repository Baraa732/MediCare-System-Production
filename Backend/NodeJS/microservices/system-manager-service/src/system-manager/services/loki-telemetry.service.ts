import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { PlatformLogEntry, PlatformLogLevel } from './platform-logs.service';
import { SERVICE_CONTAINERS } from './platform-logs.service';
import { normalizeServiceLabel, parseLogLine } from './log-line.parser';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveLokiBaseUrl } = require('@medicare/telemetry/loki-url') as {
  resolveLokiBaseUrl: () => string;
};

export interface StructuredLogRow {
  timestamp: string;
  service: string;
  level: PlatformLogLevel;
  message: string;
  traceId: string | null;
  spanId: string | null;
  requestId: string | null;
  raw: string;
}

@Injectable()
export class LokiTelemetryService {
  private readonly logger = new Logger(LokiTelemetryService.name);
  private readonly baseUrl = resolveLokiBaseUrl();
  private readonly knownServices = Object.keys(SERVICE_CONTAINERS);

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    const attempts = Number(process.env.LOKI_READY_RETRIES || 4);
    const timeoutMs = Number(process.env.LOKI_READY_TIMEOUT_MS || 4000);
    let lastError = 'unknown';

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await axios.get(`${this.baseUrl}/ready`, { timeout: timeoutMs });
        return true;
      } catch (error) {
        lastError = String(error);
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    this.logger.warn(`Loki not reachable at ${this.baseUrl}/ready after ${attempts} attempts: ${lastError}`);
    return false;
  }

  async queryLogs(params: {
    services?: string[];
    levels?: PlatformLogLevel[];
    search?: string;
    range?: string;
    limit?: number;
  }): Promise<StructuredLogRow[]> {
    const rangeSeconds = params.range === '24h' ? 86400 : params.range === '6h' ? 21600 : params.range === '15m' ? 900 : 3600;
    const limit = Math.min(params.limit ?? 500, 2000);
    const serviceNames = (params.services?.length ? params.services : this.knownServices)
      .map((name) => normalizeServiceLabel(name))
      .filter((name) => this.knownServices.includes(name) || params.services?.includes(name));

    const lokiServices = serviceNames.flatMap((name) => {
      if (name === 'system-manager-service') return [name, 'system_manager-service'];
      return [name];
    });

    const serviceFilter = `{service=~"${[...new Set(lokiServices)].join('|')}"}`;
    const query = serviceFilter;

    try {
      const end = Date.now() * 1_000_000;
      const start = (Date.now() - rangeSeconds * 1000) * 1_000_000;
      const { data } = await axios.get(`${this.baseUrl}/loki/api/v1/query_range`, {
        params: {
          query,
          limit,
          start,
          end,
          direction: 'backward',
        },
          timeout: 8000,
      });

      const rows: StructuredLogRow[] = [];
      for (const stream of data?.data?.result ?? []) {
        const labels = stream.stream ?? {};
        const service = normalizeServiceLabel(String(labels.service ?? labels.job ?? 'unknown'));
        for (const [ts, line] of stream.values ?? []) {
          const parsed = parseLogLine(String(line), service, ts);
          if (parsed) rows.push(parsed);
        }
      }

      rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      let filtered = rows;
      if (params.levels?.length) {
        const allowed = new Set(params.levels);
        filtered = filtered.filter((r) => allowed.has(r.level));
      }
      if (params.search?.trim()) {
        const needle = params.search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.message.toLowerCase().includes(needle)
            || r.service.toLowerCase().includes(needle)
            || r.raw.toLowerCase().includes(needle)
            || (r.traceId ?? '').toLowerCase().includes(needle),
        );
      }

      return filtered.slice(0, limit);
    } catch (error) {
      this.logger.debug(`Loki query failed: ${String(error)}`);
      return [];
    }
  }

  toPlatformLogEntry(row: StructuredLogRow, index: number): PlatformLogEntry {
    return {
      id: `${row.service}-${row.timestamp}-${index}`,
      timestamp: row.timestamp,
      level: row.level,
      service: row.service,
      message: row.message,
      raw: row.raw,
      traceId: row.traceId,
      spanId: row.spanId,
      requestId: row.requestId,
    };
  }
}
