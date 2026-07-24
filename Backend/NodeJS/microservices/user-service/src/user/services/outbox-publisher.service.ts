import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { OutboxEvent, OutboxStatus } from '../entities/outbox-event.entity';
import { KafkaTopics } from '../../kafka-shared/topics/topics.config';
import { withTenantEvent } from '../../tenant-shared/tenant.constants';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createSignedKafkaEnvelope } from '../../kafka-security-shared/kafka-event.signer';

const LEGACY_CREATE_BY_ADMIN_TOPIC = 'user.created.by.admin';

const POLL_INTERVAL_MS  = 5_000;   // poll every 5 seconds
const BATCH_SIZE        = 50;      // process up to 50 events per poll cycle
const MAX_RETRIES       = 5;       // mark FAILED after 5 consecutive failures

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private outboxRepository: Repository<OutboxEvent>,
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka,
    private readonly tenantContext: TenantContextService,
  ) {}

  async onModuleInit() {
    const repaired = await this.outboxRepository.update(
      { eventType: LEGACY_CREATE_BY_ADMIN_TOPIC },
      {
        eventType: KafkaTopics.USER_CREATE_BY_ADMIN,
        status: OutboxStatus.PENDING,
        retryCount: 0,
        lastError: null,
      },
    );

    if (repaired.affected && repaired.affected > 0) {
      this.logger.warn(
        `Repaired ${repaired.affected} outbox event(s) using legacy topic ${LEGACY_CREATE_BY_ADMIN_TOPIC}`,
      );
    }

    this.pollTimer = setInterval(() => this.publishPending(), POLL_INTERVAL_MS);
    this.logger.log(`Outbox publisher started — polling every ${POLL_INTERVAL_MS}ms`);

    // One-shot recovery: re-queue permanently FAILED events so a fixed config
    // (e.g. missing Kafka signing secret) can publish them after redeploy.
    void this.retryFailed().catch((err: Error) => {
      this.logger.warn(`Outbox FAILED reset on startup skipped: ${err.message}`);
    });
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ─── Core poll loop ───────────────────────────────────────────────────────
  async publishPending(): Promise<void> {
    // Prevent overlapping poll cycles if Kafka is slow
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Only PENDING is auto-polled. FAILED means retries were exhausted —
      // re-queue via retryFailed() (startup recovery / admin), not every poll.
      const events = await this.outboxRepository.find({
        where: { status: OutboxStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: BATCH_SIZE,
      });

      if (events.length === 0) return;

      this.logger.debug(`Publishing ${events.length} outbox events`);

      for (const event of events) {
        await this.publishOne(event);
      }
    } catch (err: any) {
      this.logger.error(`Outbox poll cycle failed: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async publishOne(event: OutboxEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const tenantId =
      (payload.tenantId as string | undefined) ?? (payload.clinicId as string | undefined);

    const runPublish = async (): Promise<void> => {
      try {
        const messagePayload = tenantId
          ? ({ ...payload, tenantId, clinicId: tenantId } as Record<string, unknown>)
          : (payload as Record<string, unknown>);
        const envelope = createSignedKafkaEnvelope(event.eventType, messagePayload);

        await new Promise<void>((resolve, reject) => {
          this.kafkaClient.emit(event.eventType, envelope).subscribe({
            error: reject,
            complete: resolve,
          });
        });

        await this.outboxRepository.update(event.id, {
          status: OutboxStatus.PUBLISHED,
          publishedAt: new Date(),
        });

        this.logger.debug(`Published outbox event ${event.id} → ${event.eventType}`);
      } catch (err: any) {
        const newRetryCount = event.retryCount + 1;
        const newStatus = newRetryCount >= MAX_RETRIES
          ? OutboxStatus.FAILED
          : OutboxStatus.PENDING;

        await this.outboxRepository.update(event.id, {
          status: newStatus,
          retryCount: newRetryCount,
          lastError: err.message?.substring(0, 500),
        });

        if (newStatus === OutboxStatus.FAILED) {
          this.logger.error(
            `Outbox event ${event.id} (${event.eventType}) permanently failed after ${MAX_RETRIES} retries: ${err.message}`,
          );
        } else {
          this.logger.warn(
            `Outbox event ${event.id} (${event.eventType}) failed (attempt ${newRetryCount}/${MAX_RETRIES}): ${err.message}`,
          );
        }
      }
    };

    if (tenantId) {
      await this.tenantContext.run({ tenantId, service: process.env.SERVICE_NAME }, runPublish);
    } else {
      await runPublish();
    }
  }

  // ─── Manual recovery — called by admin endpoint or health check ───────────
  async retryFailed(): Promise<{ retried: number }> {
    const result = await this.outboxRepository.update(
      { status: OutboxStatus.FAILED },
      { status: OutboxStatus.PENDING, retryCount: 0, lastError: null },
    );
    const retried = result.affected ?? 0;
    this.logger.log(`Reset ${retried} FAILED outbox events to PENDING`);
    return { retried };
  }

  async getPendingCount(): Promise<number> {
    return this.outboxRepository.count({ where: { status: OutboxStatus.PENDING } });
  }

  async getFailedCount(): Promise<number> {
    return this.outboxRepository.count({ where: { status: OutboxStatus.FAILED } });
  }
}
