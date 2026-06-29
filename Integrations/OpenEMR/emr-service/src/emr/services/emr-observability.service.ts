import { Injectable, Logger } from '@nestjs/common';

export interface EmrTenantMetricSnapshot {
  tenantId: string;
  syncAttempts: number;
  syncFailures: number;
}

@Injectable()
export class EmrObservabilityService {
  private readonly logger = new Logger(EmrObservabilityService.name);
  private readonly byTenant = new Map<string, EmrTenantMetricSnapshot>();

  recordSyncAttempt(tenantId: string): void {
    const row = this.byTenant.get(tenantId) ?? {
      tenantId,
      syncAttempts: 0,
      syncFailures: 0,
    };
    row.syncAttempts += 1;
    this.byTenant.set(tenantId, row);
    this.logger.debug(`tenantId=${tenantId} event=emr_sync_attempt`);
  }

  recordEmrSyncFailure(tenantId: string, userId: string, error: string): void {
    const row = this.byTenant.get(tenantId) ?? {
      tenantId,
      syncAttempts: 0,
      syncFailures: 0,
    };
    row.syncFailures += 1;
    this.byTenant.set(tenantId, row);
    this.logger.error(
      `tenantId=${tenantId} event=emr_sync_failed userId=${userId} error=${error.substring(0, 200)}`,
    );
  }

  recordKafkaLag(tenantId: string | null, topic: string, lagMs: number): void {
    this.logger.warn(
      `tenantId=${tenantId ?? 'unknown'} event=kafka_lag topic=${topic} lagMs=${lagMs}`,
    );
  }

  getTenantMetrics(): EmrTenantMetricSnapshot[] {
    return [...this.byTenant.values()];
  }
}
