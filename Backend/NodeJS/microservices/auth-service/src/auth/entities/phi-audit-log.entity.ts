import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('phi_audit_logs')
@Index(['tenantId', 'timestamp'])
@Index(['actorId', 'timestamp'])
@Index(['resourceType', 'resourceId'])
@Index(['action'])
@Index(['requestId'])
@Index(['classification'])
@Index(['timestamp'])
export class PhiAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_role', nullable: true })
  actorRole: string | null;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ length: 128 })
  action: string;

  @Column({ name: 'resource_type', length: 64 })
  resourceType: string;

  @Column({ name: 'resource_id', nullable: true })
  resourceId: string | null;

  @Column({ nullable: true, length: 45 })
  ip: string | null;

  @Column({ name: 'user_agent', nullable: true, length: 512 })
  userAgent: string | null;

  @Column({ name: 'request_id', nullable: true, length: 64 })
  requestId: string | null;

  @Column()
  success: boolean;

  @Column({ length: 32 })
  classification: string;

  @Column({ name: 'source_service', nullable: true, length: 64 })
  sourceService: string | null;

  @Column({ name: 'internal_call', default: false })
  internalCall: boolean;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;
}
