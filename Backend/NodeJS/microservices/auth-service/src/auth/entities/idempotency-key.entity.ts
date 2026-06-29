import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('idempotency_keys')
@Index(['key'], { unique: true })
@Index(['expiresAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Client-supplied idempotency key (UUID recommended)
  @Column({ unique: true })
  key: string;

  // SHA-256 hash of the request body — used to detect same-key-different-payload
  @Column()
  requestHash: string;

  // The endpoint this key was used on — prevents cross-endpoint key reuse
  @Column()
  endpoint: string;

  // Serialised JSON response — returned verbatim on duplicate requests
  @Column({ type: 'jsonb' })
  response: Record<string, unknown>;

  // HTTP status code of the original response
  @Column({ default: 200 })
  statusCode: number;

  // Keys expire after 24 hours — clients should not reuse keys across days
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
