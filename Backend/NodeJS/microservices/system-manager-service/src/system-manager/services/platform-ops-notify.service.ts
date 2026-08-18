import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemManager } from '../entities/system-manager.entity';
import { NotificationHttpClient } from './notification-http.client';
import { PlatformHealthService } from './platform-health.service';
import { PlatformObservabilityService } from './platform-observability.service';
import { PlatformQueuesService } from './platform-queues.service';
import { PlatformSecurityService } from './platform-security.service';

const POLL_MS = 45_000;

export type OpsNotifyInput = {
  title: string;
  body: string;
  severity?: 'critical' | 'high' | 'warning' | 'info';
  kind?: string;
  deepLink?: string;
  dedupeKey?: string;
  clinicId?: string;
};

@Injectable()
export class PlatformOpsNotifyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformOpsNotifyService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectRepository(SystemManager)
    private readonly managers: Repository<SystemManager>,
    private readonly notificationHttp: NotificationHttpClient,
    private readonly health: PlatformHealthService,
    private readonly observability: PlatformObservabilityService,
    private readonly queues: PlatformQueuesService,
    private readonly security: PlatformSecurityService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.scanPlatform();
    }, POLL_MS);
    setTimeout(() => void this.scanPlatform(), 8_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async notifyAll(input: OpsNotifyInput): Promise<void> {
    const userIds = await this.listActiveIds();
    if (!userIds.length) return;
    const result = await this.notificationHttp.notifySystemManagers({
      userIds,
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'warning',
      kind: input.kind ?? 'SYSTEM',
      deepLink: input.deepLink ?? '/',
      dedupeKey: input.dedupeKey,
      clinicId: input.clinicId,
    });
    if (!result.success) {
      this.logger.warn(`Ops notify failed: ${input.dedupeKey ?? input.title}`);
    }
  }

  private async listActiveIds(): Promise<string[]> {
    const rows = await this.managers.find({
      where: { isActive: true },
      select: ['id'],
    });
    return rows.map((row) => row.id);
  }

  private async scanPlatform(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const [health, queues, alerts, security] = await Promise.all([
        this.health.getPlatformHealth().catch(() => null),
        this.queues.getOverview().catch(() => null),
        this.observability.getFiringAlerts().catch(() => null),
        this.security.getSummary('1h').catch(() => null),
      ]);

      for (const service of health?.services ?? []) {
        if (service.status !== 'down') continue;
        await this.notifyAll({
          title: `${service.name} is down`,
          body: `Health probe for ${service.name} failed. Open System Health for live checks.`,
          severity: 'critical',
          kind: 'HEALTH',
          deepLink: '/cc/system-health',
          dedupeKey: `health:down:${service.name}`,
        });
      }

      const infra = health?.infrastructure;
      if (infra) {
        for (const [name, status] of Object.entries(infra)) {
          if (status !== 'error') continue;
          await this.notifyAll({
            title: `${name} probe failed`,
            body: `Infrastructure check "${name}" returned error.`,
            severity: 'critical',
            kind: 'HEALTH',
            deepLink: name === 'kafka' ? '/cc/queues' : '/cc/databases',
            dedupeKey: `infra:${name}`,
          });
        }
      }

      for (const item of queues?.items ?? []) {
        if (item.status !== 'Critical') continue;
        await this.notifyAll({
          title: `Queue critical: ${item.name}`,
          body: `Lag ${item.lag} · ${item.consumers} consumers · ${item.messages} messages.`,
          severity: 'critical',
          kind: 'QUEUE',
          deepLink: '/cc/queues',
          dedupeKey: `queue:${item.name}`,
        });
      }

      for (const alert of alerts?.items ?? []) {
        if (alert.severity !== 'critical' && alert.severity !== 'high') continue;
        await this.notifyAll({
          title: alert.name,
          body: `${alert.service}: ${alert.summary || alert.condition} (${alert.value})`,
          severity: alert.severity,
          kind: 'ALERT',
          deepLink: '/alerts',
          dedupeKey: `alert:${alert.id}`,
        });
      }

      const threat = security?.threatScore ?? 0;
      const failed = security?.failedLogins ?? 0;
      if (security?.available && (threat >= 60 || failed >= 8)) {
        const hour = new Date().toISOString().slice(0, 13);
        await this.notifyAll({
          title: 'Elevated security pressure',
          body: `Threat score ${threat} · ${failed} failed logins in ${security.range}.`,
          severity: threat >= 60 ? 'critical' : 'high',
          kind: 'SECURITY',
          deepLink: '/cc/security',
          dedupeKey: `security:threat:${hour}`,
        });
      }
    } catch (error) {
      this.logger.warn(`Platform notification scan failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
