import { Injectable } from '@nestjs/common';
import { PrometheusTelemetryService } from './prometheus-telemetry.service';
import { PlatformHealthService } from './platform-health.service';

export interface QueueItem {
  name: string;
  messages: number;
  consumers: number;
  lag: number;
  status: 'Healthy' | 'Warning' | 'Critical' | 'Unknown';
}

@Injectable()
export class PlatformQueuesService {
  constructor(
    private readonly prometheus: PrometheusTelemetryService,
    private readonly health: PlatformHealthService,
  ) {}

  async getOverview(): Promise<{
    available: boolean;
    timestamp: string;
    warning?: string;
    items: QueueItem[];
  }> {
    const promUp = await this.prometheus.isAvailable();
    if (!promUp) {
      const health = await this.health.getPlatformHealth();
      const kafka = health.infrastructure?.kafka ?? 'unknown';
      return {
        available: false,
        timestamp: new Date().toISOString(),
        warning: 'Prometheus unreachable — showing Kafka health only',
        items: [
          {
            name: 'kafka',
            messages: 0,
            consumers: 0,
            lag: 0,
            status:
              kafka === 'ok' ? 'Healthy' : kafka === 'error' ? 'Critical' : 'Unknown',
          },
        ],
      };
    }

    const [maxLag, outboxPending, outboxFailed] = await Promise.all([
      this.prometheus.queryInstant('slo:kafka_max_consumer_lag'),
      this.prometheus.queryInstant('slo:outbox_pending_events'),
      this.prometheus.queryInstant(
        'sum(medicare_outbox_events{status="FAILED"}) or sum(outbox_events_total{status="failed"})',
      ),
    ]);

    const items: QueueItem[] = [];

    if (maxLag !== null) {
      items.push({
        name: 'kafka-consumer-lag',
        messages: Math.round(maxLag),
        consumers: 0,
        lag: Math.round(maxLag),
        status: maxLag > 1000 ? 'Critical' : maxLag > 100 ? 'Warning' : 'Healthy',
      });
    }

    if (outboxPending !== null) {
      items.push({
        name: 'outbox-pending',
        messages: Math.round(outboxPending),
        consumers: 1,
        lag: Math.round(outboxPending),
        status:
          outboxPending > 500 ? 'Critical' : outboxPending > 50 ? 'Warning' : 'Healthy',
      });
    }

    if (outboxFailed !== null && outboxFailed > 0) {
      items.push({
        name: 'outbox-failed',
        messages: Math.round(outboxFailed),
        consumers: 0,
        lag: Math.round(outboxFailed),
        status: 'Critical',
      });
    }

    if (items.length === 0) {
      return {
        available: false,
        timestamp: new Date().toISOString(),
        warning: 'No queue lag metrics exported yet',
        items: [],
      };
    }

    return {
      available: true,
      timestamp: new Date().toISOString(),
      items,
    };
  }
}
