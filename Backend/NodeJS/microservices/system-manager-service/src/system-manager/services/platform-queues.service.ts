import { Injectable, Logger } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { PrometheusTelemetryService } from './prometheus-telemetry.service';
import { PlatformHealthService } from './platform-health.service';

export interface QueueItem {
  name: string;
  messages: number;
  consumers: number;
  lag: number;
  status: 'Healthy' | 'Warning' | 'Critical' | 'Unknown';
}

type Overview = {
  available: boolean;
  timestamp: string;
  warning?: string;
  source: 'kafka' | 'prometheus' | 'health';
  topics: number;
  groups: number;
  items: QueueItem[];
};

const CACHE_MS = 12_000;
const ADMIN_TIMEOUT_MS = 6_000;

function parseOffset(raw: string | undefined): number {
  if (raw == null || raw === '' || raw === '-1') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function lagStatus(lag: number): QueueItem['status'] {
  if (lag > 1000) return 'Critical';
  if (lag > 100) return 'Warning';
  return 'Healthy';
}

@Injectable()
export class PlatformQueuesService {
  private readonly logger = new Logger(PlatformQueuesService.name);
  private cache: { expiresAt: number; value: Overview } | null = null;
  private inflight: Promise<Overview> | null = null;

  constructor(
    private readonly prometheus: PrometheusTelemetryService,
    private readonly health: PlatformHealthService,
  ) {}

  async getOverview(): Promise<Overview> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    if (this.inflight) return this.inflight;
    this.inflight = this.buildOverview()
      .then((value) => {
        this.cache = { expiresAt: Date.now() + CACHE_MS, value };
        return value;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  private async buildOverview(): Promise<Overview> {
    const [promItems, kafkaSnap, health] = await Promise.all([
      this.prometheusQueues(),
      this.kafkaSnapshot(),
      this.health.getPlatformHealth(),
    ]);

    const kafkaHealth = health.infrastructure?.kafka ?? 'unknown';
    const items: QueueItem[] = [];

    if (kafkaSnap) {
      items.push({
        name: 'kafka-cluster',
        messages: kafkaSnap.topicCount,
        consumers: kafkaSnap.groupCount,
        lag: kafkaSnap.maxLag,
        status:
          kafkaHealth === 'error'
            ? 'Critical'
            : kafkaSnap.maxLag > 1000
              ? 'Critical'
              : kafkaSnap.maxLag > 100
                ? 'Warning'
                : 'Healthy',
      });
      items.push(...kafkaSnap.groups);
      if (kafkaSnap.dltTopics > 0) {
        items.push({
          name: 'dead-letter-topics',
          messages: kafkaSnap.dltTopics,
          consumers: 0,
          lag: kafkaSnap.dltTopics,
          status: 'Warning',
        });
      }
    } else {
      items.push({
        name: 'kafka-cluster',
        messages: 0,
        consumers: 0,
        lag: 0,
        status:
          kafkaHealth === 'ok' ? 'Healthy' : kafkaHealth === 'error' ? 'Critical' : 'Unknown',
      });
    }

    for (const extra of promItems) {
      if (!items.some((i) => i.name === extra.name)) items.push(extra);
    }

    const source = kafkaSnap ? 'kafka' : promItems.length ? 'prometheus' : 'health';
    const available = Boolean(kafkaSnap) || promItems.length > 0 || kafkaHealth === 'ok';

    return {
      available,
      timestamp: new Date().toISOString(),
      source,
      topics: kafkaSnap?.topicCount ?? 0,
      groups: kafkaSnap?.groupCount ?? 0,
      warning: kafkaSnap
        ? undefined
        : 'Kafka admin snapshot unavailable — showing broker health',
      items: items.slice(0, 16),
    };
  }

  private async prometheusQueues(): Promise<QueueItem[]> {
    const [maxLag, outboxPending, outboxFailed] = await Promise.all([
      this.prometheus.queryInstant(
        'slo:kafka_max_consumer_lag or max(kafka_consumer_group_lag) or max(kafka_consumergroup_lag)',
      ),
      this.prometheus.queryInstant(
        'slo:outbox_pending_events or outbox_pending_events_total or medicare_outbox_pending',
      ),
      this.prometheus.queryInstant(
        'sum(medicare_outbox_events{status="FAILED"}) or sum(outbox_events_total{status="failed"})',
      ),
    ]);

    const items: QueueItem[] = [];
    if (maxLag !== null) {
      items.push({
        name: 'prometheus-consumer-lag',
        messages: Math.round(maxLag),
        consumers: 0,
        lag: Math.round(maxLag),
        status: lagStatus(maxLag),
      });
    }
    if (outboxPending !== null) {
      items.push({
        name: 'outbox-pending',
        messages: Math.round(outboxPending),
        consumers: 1,
        lag: Math.round(outboxPending),
        status: lagStatus(outboxPending),
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
    return items;
  }

  private brokers(): string[] {
    return (process.env.KAFKA_BROKERS ?? 'kafka.railway.internal:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
  }

  private async kafkaSnapshot(): Promise<{
    topicCount: number;
    groupCount: number;
    maxLag: number;
    dltTopics: number;
    groups: QueueItem[];
  } | null> {
    const kafka = new Kafka({
      clientId: 'system-manager-queues',
      brokers: this.brokers(),
      connectionTimeout: 4000,
      requestTimeout: 4000,
    });
    const admin = kafka.admin();
    const work = (async () => {
      await admin.connect();
      const [topicList, groupList] = await Promise.all([
        admin.listTopics(),
        admin.listGroups(),
      ]);
      const topics = topicList.filter((t) => !t.startsWith('__'));
      const dltTopics = topics.filter((t) => t.endsWith('.dlt') || t.includes('.dlt.')).length;
      const groups = groupList.groups
        .filter((g) => !g.protocolType || g.protocolType === 'consumer')
        .slice(0, 12);

      const topicHigh = new Map<string, number>();
      const uniqueTopics = topics.filter((t) => !t.endsWith('.dlt')).slice(0, 24);
      await Promise.all(
        uniqueTopics.map(async (topic) => {
          try {
            const parts = await admin.fetchTopicOffsets(topic);
            const high = parts.reduce((sum, p) => sum + parseOffset(p.high ?? p.offset), 0);
            topicHigh.set(topic, high);
          } catch {
            /* topic may not exist for this ACL */
          }
        }),
      );

      const groupItems: QueueItem[] = [];
      await Promise.all(
        groups.map(async (g) => {
          try {
            const committed = await admin.fetchOffsets({ groupId: g.groupId });
            let lag = 0;
            let messages = 0;
            for (const topicOffsets of committed) {
              const high = topicHigh.get(topicOffsets.topic) ?? 0;
              const committedSum = topicOffsets.partitions.reduce(
                (sum, p) => sum + parseOffset(p.offset),
                0,
              );
              messages += high;
              lag += Math.max(0, high - committedSum);
            }
            groupItems.push({
              name: g.groupId || 'consumer-group',
              messages,
              consumers: 1,
              lag,
              status: lagStatus(lag),
            });
          } catch {
            groupItems.push({
              name: g.groupId || 'consumer-group',
              messages: 0,
              consumers: 1,
              lag: 0,
              status: 'Unknown',
            });
          }
        }),
      );

      groupItems.sort((a, b) => b.lag - a.lag);
      const maxLag = groupItems.reduce((m, g) => Math.max(m, g.lag), 0);
      return {
        topicCount: topics.length,
        groupCount: groupList.groups.length,
        maxLag,
        dltTopics,
        groups: groupItems.slice(0, 8),
      };
    })();
    void work.catch(() => undefined);

    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ADMIN_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([work, timeout]);
      if (!result) {
        this.logger.warn('Kafka admin snapshot timed out');
        return null;
      }
      return result;
    } catch (error) {
      this.logger.warn(`Kafka admin snapshot failed: ${String(error)}`);
      return null;
    } finally {
      await admin.disconnect().catch(() => undefined);
    }
  }
}
