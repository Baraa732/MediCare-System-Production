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

export type ConversationMessageRole = 'user' | 'assistant';

@Entity('ai_conversation_messages')
@Unique('uq_messages_thread_seq', ['threadId', 'seq'])
@Index('idx_messages_thread', ['threadId', 'seq'])
@Index('idx_messages_patient', ['patientId'])
@Index('idx_messages_tenant_patient', ['tenantId', 'patientId'])
export class AiConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @ManyToOne(() => AiConversationThread, (thread) => thread.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: AiConversationThread;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ type: 'int' })
  seq: number;

  @Column({ length: 16 })
  role: ConversationMessageRole;

  @Column({ type: 'bytea' })
  ciphertext: Buffer;

  @Column({ type: 'bytea' })
  nonce: Buffer;

  @Column({ name: 'key_version', type: 'smallint' })
  keyVersion: number;

  @Column({ name: 'content_mac', type: 'char', length: 64 })
  contentMac: string;

  @Column({ name: 'detected_lang', length: 8, nullable: true })
  detectedLang?: string;

  @Column({ name: 'redaction_flags', type: 'jsonb', default: () => "'{}'" })
  redactionFlags: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
