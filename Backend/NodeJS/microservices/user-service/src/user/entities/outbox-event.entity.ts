import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

export enum OutboxStatus {
  PENDING   = 'pending',
  PUBLISHED = 'published',
  FAILED    = 'failed',
}

@Entity('outbox_events')
@Index(['status', 'createdAt'])          // poller query: WHERE status='pending' ORDER BY createdAt
@Index(['aggregateId', 'eventType'])     // deduplication lookup
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The ID of the business entity this event belongs to (e.g. user.id)
  @Column()
  aggregateId: string;

  // The domain entity type (e.g. 'User', 'ClinicAdmin')
  @Column()
  aggregateType: string;

  // The Kafka topic this event should be published to
  @Column()
  eventType: string;

  // Full event payload — serialised JSON
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: OutboxStatus,
    default: OutboxStatus.PENDING,
  })
  status: OutboxStatus;

  // How many publish attempts have been made
  @Column({ default: 0 })
  retryCount: number;

  // Last error message — useful for debugging stuck events
  @Column({ nullable: true })
  lastError: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  publishedAt: Date;
}
