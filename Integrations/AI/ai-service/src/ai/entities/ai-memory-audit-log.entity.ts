import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { MemoryAuditAction } from '../memory/memory.types';

@Entity('ai_memory_audit_log')
@Index('idx_audit_patient', ['patientId', 'createdAt'])
@Index('idx_audit_tenant_patient', ['tenantId', 'patientId'])
export class AiMemoryAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  @Column({ name: 'actor_role', length: 32, nullable: true })
  actorRole?: string;

  @Column({ length: 64 })
  action: MemoryAuditAction;

  @Column({ name: 'resource_type', length: 32, nullable: true })
  resourceType?: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string;

  @Column({ name: 'reason_code', length: 64, nullable: true })
  reasonCode?: string;

  @Column({ name: 'correlation_id', length: 64, nullable: true })
  correlationId?: string;

  @Column({ name: 'metadata_json', type: 'jsonb', default: () => "'{}'" })
  metadataJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
