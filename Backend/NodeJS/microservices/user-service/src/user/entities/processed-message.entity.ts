import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Fix 24: Kafka consumer idempotency store.
 * Before processing any message, consumers check (messageId, topic).
 * If found, the message is skipped (already processed).
 * Composite PK ensures exactly-once processing per topic.
 */
@Entity('processed_messages')
export class ProcessedMessage {
  @PrimaryColumn({ name: 'message_id', length: 128 })
  messageId: string;

  @PrimaryColumn({ length: 128 })
  topic: string;

  @Index()
  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
