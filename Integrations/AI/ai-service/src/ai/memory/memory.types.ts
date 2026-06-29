export type ConsentScope =
  | 'conversation_storage'
  | 'preference_memory'
  | 'summarization'
  | 'clinical_memory';

export type MemoryAuditAction =
  | 'memory.write'
  | 'memory.reject'
  | 'memory.pending_approval'
  | 'memory.approved'
  | 'memory.expired'
  | 'consent.grant'
  | 'consent.revoke'
  | 'summary.created'
  | 'summary.regenerated'
  | 'summary.redacted'
  | 'summary.validation_failed'
  | 'erasure.requested'
  | 'erasure.completed'
  | 'encryption.key_rotated'
  | 'integrity.mac_failed';

export type ConversationChannel = 'booking' | 'patient_chat';

export type ConversationMessageRole = 'user' | 'assistant';

export type SummarySource = 'llm' | 'regenerated' | 'redacted';
