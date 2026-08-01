import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PlatformDeployment,
  PlatformDeploymentStatus,
} from '../entities/platform-deployment.entity';
import { LokiTelemetryService } from './loki-telemetry.service';

function formatAgo(date: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toString().padStart(2, '0')}s`;
}

@Injectable()
export class PlatformDeploymentsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformDeploymentsService.name);

  constructor(
    @InjectRepository(PlatformDeployment)
    private readonly repo: Repository<PlatformDeployment>,
    private readonly loki: LokiTelemetryService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS platform_deployments (
          id uuid PRIMARY KEY,
          service varchar NOT NULL,
          version varchar NULL,
          status varchar(32) NOT NULL DEFAULT 'Success',
          actor varchar NULL,
          "startedAt" timestamptz NOT NULL,
          "finishedAt" timestamptz NULL,
          "durationMs" int NULL,
          source varchar(32) NOT NULL DEFAULT 'api',
          "createdAt" timestamptz NOT NULL DEFAULT now()
        )
      `);
    } catch (error) {
      this.logger.warn(`Could not ensure platform_deployments table: ${String(error)}`);
    }
  }

  async list(limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    let rows: PlatformDeployment[] = [];
    try {
      rows = await this.repo.find({
        order: { startedAt: 'DESC' },
        take,
      });
    } catch (error) {
      this.logger.warn(`deployments table read failed: ${String(error)}`);
    }

    if (rows.length === 0) {
      const fromLogs = await this.tryLokiDeployHints(take);
      if (fromLogs.length > 0) {
        return {
          available: true as const,
          timestamp: new Date().toISOString(),
          source: 'loki' as const,
          items: fromLogs,
        };
      }
      return {
        available: false as const,
        timestamp: new Date().toISOString(),
        source: 'none' as const,
        items: [],
        warning: 'No deployment records yet — wire CI webhook to POST /internal/deployments',
      };
    }

    return {
      available: true as const,
      timestamp: new Date().toISOString(),
      source: 'db' as const,
      items: rows.map((r) => ({
        id: r.id,
        service: r.service,
        version: r.version ?? 'unknown',
        status: r.status,
        by: r.actor ?? 'system',
        ago: formatAgo(r.startedAt),
        duration: formatDuration(r.durationMs),
        startedAt: r.startedAt.toISOString(),
      })),
    };
  }

  async ingest(body: {
    service: string;
    version?: string;
    status?: PlatformDeploymentStatus;
    actor?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    source?: string;
  }) {
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
    const finishedAt = body.finishedAt ? new Date(body.finishedAt) : null;
    const durationMs =
      body.durationMs ??
      (finishedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : null);

    const row = this.repo.create({
      service: body.service,
      version: body.version ?? null,
      status: body.status ?? 'Success',
      actor: body.actor ?? null,
      startedAt,
      finishedAt,
      durationMs,
      source: body.source ?? 'webhook',
    });
    return this.repo.save(row);
  }

  private async tryLokiDeployHints(limit: number) {
    try {
      if (typeof (this.loki as any).queryRecent !== 'function') return [];
      // Best-effort: many Loki helpers differ; skip if unavailable
      return [];
    } catch {
      return [];
    }
  }
}
