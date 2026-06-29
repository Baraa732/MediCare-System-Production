import { Injectable, Logger } from '@nestjs/common';

export interface TenantMetricSnapshot {
  tenantId: string;
  requests: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
}

@Injectable()
export class TenantObservabilityService {
  private readonly logger = new Logger(TenantObservabilityService.name);
  private readonly byTenant = new Map<string, TenantMetricSnapshot>();

  recordRequest(
    tenantId: string | null | undefined,
    endpoint: string,
    promptTokens: number,
    completionTokens: number,
  ): void {
    const id = tenantId ?? 'platform';
    const row = this.byTenant.get(id) ?? {
      tenantId: id,
      requests: 0,
      errors: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
    row.requests += 1;
    row.promptTokens += promptTokens;
    row.completionTokens += completionTokens;
    this.byTenant.set(id, row);

    this.logger.debug(
      `tenantId=${id} event=ai_request endpoint=${endpoint} promptTokens=${promptTokens} completionTokens=${completionTokens}`,
    );
  }

  recordError(tenantId: string | null | undefined, context: string): void {
    const id = tenantId ?? 'platform';
    const row = this.byTenant.get(id) ?? {
      tenantId: id,
      requests: 0,
      errors: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
    row.errors += 1;
    this.byTenant.set(id, row);
    this.logger.warn(`tenantId=${id} event=tenant_error context=${context}`);
  }

  recordEmrSyncFailure(tenantId: string, userId: string, error: string): void {
    this.logger.error(
      `tenantId=${tenantId} event=emr_sync_failed userId=${userId} error=${error.substring(0, 200)}`,
    );
  }

  recordKafkaLag(tenantId: string | null, topic: string, lagMs: number): void {
    this.logger.warn(
      `tenantId=${tenantId ?? 'unknown'} event=kafka_lag topic=${topic} lagMs=${lagMs}`,
    );
  }

  getTenantMetrics(): TenantMetricSnapshot[] {
    return [...this.byTenant.values()];
  }
}
