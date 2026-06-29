import { Logger } from '@nestjs/common';

/**
 * Lightweight per-tenant queue throttle for Kafka consumers and background jobs.
 */
export class TenantQueueThrottle {
  private readonly logger = new Logger(TenantQueueThrottle.name);
  private readonly lastProcessed = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  async throttle(tenantId: string, context = 'kafka'): Promise<void> {
    const id = tenantId || 'platform';
    const now = Date.now();
    const last = this.lastProcessed.get(id) ?? 0;
    const waitMs = this.minIntervalMs - (now - last);
    if (waitMs > 0) {
      this.logger.debug(`tenantId=${id} event=queue_throttle context=${context} waitMs=${waitMs}`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastProcessed.set(id, Date.now());
  }
}
