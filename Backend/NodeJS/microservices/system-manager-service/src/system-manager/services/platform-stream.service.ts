import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PlatformObservabilityService } from './platform-observability.service';
import { PlatformLogsService } from './platform-logs.service';

export interface StreamEventPayload {
  type: 'observability' | 'logs' | 'alerts' | 'service_health' | 'heartbeat';
  range?: string;
  ts?: number;
}

@Injectable()
export class PlatformStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(PlatformStreamService.name);
  private readonly clients = new Set<Response>();
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private lastObservabilityHash = '';
  private lastLogsHash = '';

  constructor(
    private readonly platformObservabilityService: PlatformObservabilityService,
    private readonly platformLogsService: PlatformLogsService,
  ) {}

  onModuleDestroy() {
    this.stopBroadcast();
    for (const res of this.clients) {
      try {
        res.end();
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
        res.end();
      } catch {
        /* ignore */
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);

    this.writeEvent(res, { type: 'heartbeat', ts: Date.now() });
    void this.pushUpdates(range, true);
  }

  private ensureBroadcast(range: string) {
    if (this.broadcastTimer) return;
    this.broadcastTimer = setInterval(() => {
      void this.pushUpdates(range, false);
    }, 900);
  }

  private stopBroadcast() {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  private async pushUpdates(range: string, force: boolean) {
    if (!this.clients.size) return;

    try {
      const [observability, logs] = await Promise.all([
        this.platformObservabilityService.getOverview(range),
        this.platformLogsService.getPlatformLogs({ range, limit: 200 }),
      ]);

      const obsHash = `${observability.timestamp}:${observability.apm.services.length}`;
      const logsHash = `${logs.timestamp}:${logs.entries.length}`;

      if (force || obsHash !== this.lastObservabilityHash) {
        this.lastObservabilityHash = obsHash;
        this.broadcast({ type: 'observability', range });
        this.broadcast({ type: 'service_health', range });
        this.broadcast({ type: 'alerts', range });
      }

      if (force || logsHash !== this.lastLogsHash) {
        this.lastLogsHash = logsHash;
        this.broadcast({ type: 'logs' });
      }
    } catch (error) {
      this.logger.debug(`Stream push failed: ${String(error)}`);
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
