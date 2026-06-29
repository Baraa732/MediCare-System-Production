import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ConsentScope } from '../memory/memory.types';

@Entity('ai_patient_consents')
@Index('idx_consent_patient', ['patientId', 'scope'])
@Index('idx_consent_tenant_patient', ['tenantId', 'patientId'])
export class AiPatientConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ length: 32 })
  scope: ConsentScope;

  @Column({ type: 'boolean' })
  granted: boolean;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'ip_hash', type: 'char', length: 64, nullable: true })
  ipHash?: string;

  @Column({ name: 'user_agent_hash', type: 'char', length: 64, nullable: true })
  userAgentHash?: string;

  @Column({ length: 16 })
  version: string;
}
