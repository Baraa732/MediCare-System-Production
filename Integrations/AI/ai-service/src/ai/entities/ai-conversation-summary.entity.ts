import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { AiConversationThread } from './ai-conversation-thread.entity';
import { SummarySource } from '../memory/memory.types';

@Entity('ai_conversation_summaries')
@Unique('uq_summaries_thread_version', ['threadId', 'version'])
@Index('idx_summaries_tenant_patient', ['tenantId', 'patientId'])
export class AiConversationSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @ManyToOne(() => AiConversationThread, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: AiConversationThread;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ name: 'input_seq_from', type: 'int' })
  inputSeqFrom: number;

  @Column({ name: 'input_seq_to', type: 'int' })
  inputSeqTo: number;

  @Column({ name: 'summary_lang', length: 8 })
  summaryLang: string;

  @Column({ name: 'summary_prompt_version', length: 16 })
  summaryPromptVersion: string;

  @Column({ type: 'bytea' })
  ciphertext: Buffer;

  @Column({ type: 'bytea' })
  nonce: Buffer;

  @Column({ name: 'key_version', type: 'smallint' })
  keyVersion: number;

  @Column({ length: 16 })
  source: SummarySource;

  @Column({ name: 'model_id', length: 64, nullable: true })
  modelId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt?: Date;
}
