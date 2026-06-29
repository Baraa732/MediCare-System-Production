import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AiConversationMessage } from './ai-conversation-message.entity';

export type ConversationChannel = 'booking' | 'patient_chat';
export type ConversationThreadStatus = 'active' | 'archived' | 'erased';

@Entity('ai_conversation_threads')
@Index('idx_threads_patient', ['patientId'])
@Index('idx_threads_tenant', ['tenantId'])
@Index('idx_threads_tenant_patient', ['tenantId', 'patientId'])
@Index('idx_threads_retention', ['lastActivityAt'], {
  where: `"status" != 'erased'`,
})
export class AiConversationThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ length: 32 })
  channel: ConversationChannel;

  @Column({ length: 16, default: 'active' })
  status: ConversationThreadStatus;

  @Column({ name: 'preferred_lang', length: 8, nullable: true })
  preferredLang?: string;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @Column({ name: 'last_activity_at', type: 'timestamptz', default: () => 'NOW()' })
  lastActivityAt: Date;

  @Column({ name: 'wrapped_dek', type: 'bytea' })
  wrappedDek: Buffer;

  @Column({ name: 'dek_key_version', type: 'smallint' })
  dekKeyVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'erased_at', type: 'timestamptz', nullable: true })
  erasedAt?: Date;

  @OneToMany(() => AiConversationMessage, (message) => message.thread)
  messages?: AiConversationMessage[];
}
