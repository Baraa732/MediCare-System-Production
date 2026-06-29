import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_requests')
@Index('idx_ai_requests_tenant', ['tenantId'])
@Index('idx_ai_requests_tenant_user', ['tenantId', 'userId'])
@Index('idx_ai_requests_tenant_created', ['tenantId', 'createdAt'])
export class AiRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 50 })
  role: string;

  @Column({ length: 100 })
  endpoint: string;

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  @Column({ name: 'execution_time', type: 'int', default: 0 })
  executionTime: number;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
