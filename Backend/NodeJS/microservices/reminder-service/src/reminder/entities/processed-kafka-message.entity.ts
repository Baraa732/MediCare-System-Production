import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('processed_kafka_messages')
export class ProcessedKafkaMessage {
  @PrimaryColumn({ name: 'message_id', length: 128 })
  messageId: string;

  @PrimaryColumn({ length: 128 })
  topic: string;

  @Index()
  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
