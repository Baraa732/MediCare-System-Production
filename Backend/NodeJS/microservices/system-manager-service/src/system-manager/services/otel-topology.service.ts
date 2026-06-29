import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { PlatformLogEntry } from './platform-logs.service';

export interface TopologyEdge {
  source: string;
  target: string;
  count: number;
  avgLatencyMs: number;
  errorCount: number;
}

export interface DistributedTrace {
  traceId: string;
  rootService: string;
  durationMs: number;
  status: 'ok' | 'slow' | 'error';
  spans: TraceSpan[];
}

export interface TraceSpan {
  spanId: string;
  service: string;
  operation: string;
  durationMs: number;
  status: 'ok' | 'error' | 'slow';
  parentSpanId: string | null;
}

@Injectable()
export class OtelTopologyService {
  private readonly logger = new Logger(OtelTopologyService.name);
  private readonly jaegerUrl = process.env.JAEGER_QUERY_URL || 'http://jaeger:16686';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.jaegerUrl}/api/services`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Discover edges from correlated trace_id sequences in logs. */
  discoverEdgesFromLogs(entries: PlatformLogEntry[]): TopologyEdge[] {
    const byTrace = new Map<string, PlatformLogEntry[]>();
    for (const entry of entries) {
      if (!entry.traceId) continue;
      const list = byTrace.get(entry.traceId) ?? [];
      list.push(entry);
      byTrace.set(entry.traceId, list);
    }

    const edgeMap = new Map<string, TopologyEdge>();
    for (const traceEntries of byTrace.values()) {
      const ordered = [...traceEntries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (let i = 1; i < ordered.length; i += 1) {
        const source = ordered[i - 1].service;
        const target = ordered[i].service;
        if (source === target) continue;
        const key = `${source}->${target}`;
        const existing = edgeMap.get(key) ?? {
          source,
          target,
          count: 0,
          avgLatencyMs: 0,
          errorCount: 0,
        };
        existing.count += 1;
        if (ordered[i].level === 'ERROR') existing.errorCount += 1;
        edgeMap.set(key, existing);
      }
    }

    return [...edgeMap.values()].sort((a, b) => b.count - a.count);
  }

  buildServiceMapEdges(
    discovered: TopologyEdge[],
    fallback: Array<[string, string]>,
    knownServices: string[],
  ): { edges: string[][]; simulated: boolean } {
    const serviceSet = new Set(knownServices);
    const fromDiscovery = discovered
      .filter((e) => serviceSet.has(e.source) && serviceSet.has(e.target))
      .map((e) => [e.source, e.target] as [string, string]);

    if (fromDiscovery.length) {
      return { edges: fromDiscovery, simulated: false };
    }

    const filteredFallback = fallback.filter(
      ([source, target]) => serviceSet.has(source) && serviceSet.has(target),
    );
    return { edges: filteredFallback, simulated: true };
  }

  buildTracesFromLogs(entries: PlatformLogEntry[]): DistributedTrace[] {
    const byTrace = new Map<string, PlatformLogEntry[]>();
    for (const entry of entries) {
      if (!entry.traceId) continue;
      const list = byTrace.get(entry.traceId) ?? [];
      list.push(entry);
      byTrace.set(entry.traceId, list);
    }

    const traces: DistributedTrace[] = [];
    for (const [traceId, traceEntries] of byTrace.entries()) {
      const ordered = [...traceEntries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (!ordered.length) continue;

      const spans: TraceSpan[] = ordered.map((entry, index) => {
        const durationMs = this.extractDuration(entry.message) || (entry.level === 'ERROR' ? 800 : 120);
        return {
          spanId: entry.spanId ?? `${traceId}-${index}`,
          service: entry.service,
          operation: entry.message.slice(0, 80),
          durationMs,
          status: entry.level === 'ERROR' ? 'error' : durationMs > 1000 ? 'slow' : 'ok',
          parentSpanId: index > 0 ? (ordered[index - 1].spanId ?? `${traceId}-${index - 1}`) : null,
        };
      });

      const durationMs = spans.reduce((sum, s) => sum + s.durationMs, 0);
      const hasError = spans.some((s) => s.status === 'error');
      traces.push({
        traceId,
        rootService: ordered[0].service,
        durationMs,
        status: hasError ? 'error' : durationMs > 2000 ? 'slow' : 'ok',
        spans,
      });
    }

    return traces.sort((a, b) => b.durationMs - a.durationMs).slice(0, 120);
  }

  async fetchTraceFromJaeger(traceId: string): Promise<DistributedTrace | null> {
    try {
      const { data } = await axios.get(`${this.jaegerUrl}/api/traces/${traceId}`, { timeout: 5000 });
      const trace = data?.data?.[0];
      if (!trace?.spans?.length) return null;

      const spans: TraceSpan[] = trace.spans.map((span: any) => ({
        spanId: span.spanID,
        service: span.process?.serviceName ?? 'unknown',
        operation: span.operationName ?? 'span',
        durationMs: Math.round((span.duration ?? 0) / 1000),
        status: span.tags?.some((t: any) => t.key === 'error' && t.value) ? 'error' : 'ok',
        parentSpanId: span.references?.find((r: any) => r.refType === 'CHILD_OF')?.spanID ?? null,
      }));

      const durationMs = Math.max(...spans.map((s) => s.durationMs));
      return {
        traceId,
        rootService: spans[0]?.service ?? 'unknown',
        durationMs,
        status: spans.some((s) => s.status === 'error') ? 'error' : durationMs > 2000 ? 'slow' : 'ok',
        spans,
      };
    } catch (error) {
      this.logger.debug(`Jaeger trace fetch failed: ${String(error)}`);
      return null;
    }
  }

  private extractDuration(message: string): number {
    const match = message.match(/(\d+(?:\.\d+)?)\s*ms\b/i);
    return match ? Math.round(Number(match[1])) : 0;
  }
}
