import { Injectable } from '@nestjs/common';
import { TenantObservabilityService, TenantMetricSnapshot } from './tenant-observability.service';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

export interface AiMetrics {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalExecutionTimeMs: number;
  requestsByEndpoint: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
}

@Injectable()
export class AiMetricsService {
  private metrics: AiMetrics = {
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalExecutionTimeMs: 0,
    requestsByEndpoint: {},
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  };

  constructor(
    private readonly observability: TenantObservabilityService,
    private readonly tenantContext: TenantContextService,
  ) {}

  recordRequest(
    endpoint: string,
    promptTokens: number,
    completionTokens: number,
    executionTimeMs: number,
  ): void {
    this.metrics.totalRequests++;
    this.metrics.totalPromptTokens += promptTokens;
    this.metrics.totalCompletionTokens += completionTokens;
    this.metrics.totalExecutionTimeMs += executionTimeMs;
    this.metrics.requestsByEndpoint[endpoint] =
      (this.metrics.requestsByEndpoint[endpoint] || 0) + 1;
    this.observability.recordRequest(
      this.tenantContext.getTenantId(),
      endpoint,
      promptTokens,
      completionTokens,
    );
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordError(): void {
    this.metrics.errors++;
    this.observability.recordError(this.tenantContext.getTenantId(), 'ai');
  }

  getTenantMetrics(): TenantMetricSnapshot[] {
    return this.observability.getTenantMetrics();
  }

  getMetrics(): AiMetrics & { avgExecutionTimeMs: number } {
    const avg =
      this.metrics.totalRequests > 0
        ? Math.round(this.metrics.totalExecutionTimeMs / this.metrics.totalRequests)
        : 0;
    return { ...this.metrics, avgExecutionTimeMs: avg };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalExecutionTimeMs: 0,
      requestsByEndpoint: {},
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
  }
}
