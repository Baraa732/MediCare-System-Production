import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Request, Response } from 'express';

export interface StreamEventPayload {
  type: 'observability' | 'logs' | 'alerts' | 'service_health' | 'heartbeat';
  range?: string;
  ts?: number;
}

/**
 * SSE keepalive for the System Manager dashboard.
 *
 * IMPORTANT: Do NOT fetch full observability/logs payloads here.
 * A previous implementation polled getOverview() every ~900ms, which saturated
 * the service (health probes + Loki + docker fallback) and made dashboard
 * refreshes hang for minutes.
 *
 * Clients already load data via REST; this stream only:
 *  - keeps the connection alive with heartbeats
 *  - optionally nudges clients to refetch on a slow cadence
 */
@Injectable()
export class PlatformStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(PlatformStreamService.name);
  private readonly clients = new Set<Response>();
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private readonly nudgeIntervalMs = Number(process.env.PLATFORM_STREAM_NUDGE_MS || 20_000);

  onModuleDestroy() {
    this.stopBroadcast();
    for (const res of this.clients) {
      try {
        if (!res.writableEnded) res.end();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
  }

  handleConnection(req: Request, res: Response, range = '1h') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.add(res);
    this.ensureBroadcast(range);

    const heartbeat = setInterval(() => {
      this.writeEvent(res, { type: 'heartbeat', ts: Date.now() });
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
      if (this.clients.size === 0) this.stopBroadcast();
      try {
        if (!res.writableEnded) res.end();
      } catch {
        /* ignore */
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);

    this.writeEvent(res, { type: 'heartbeat', ts: Date.now() });
  }

  private ensureBroadcast(range: string) {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setInterval(() => {
      if (!this.clients.size) return;
      // Soft invalidate signal only — clients refetch their own REST endpoints.
      this.broadcast({ type: 'observability', range });
      this.broadcast({ type: 'logs' });
      this.broadcast({ type: 'alerts' });
    }, Math.max(15_000, this.nudgeIntervalMs));
  }

  private stopBroadcast() {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  private broadcast(payload: StreamEventPayload) {
    for (const res of this.clients) {
      this.writeEvent(res, payload);
    }
  }

  private writeEvent(res: Response, payload: StreamEventPayload) {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      this.clients.delete(res);
    }
  }
}
