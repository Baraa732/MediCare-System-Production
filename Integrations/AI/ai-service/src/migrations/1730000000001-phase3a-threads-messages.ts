import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3aThreadsMessages1730000000001 implements MigrationInterface {
  name = 'Phase3aThreadsMessages1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_conversation_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        channel VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        preferred_lang VARCHAR(8),
        message_count INT NOT NULL DEFAULT 0,
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        wrapped_dek BYTEA NOT NULL,
        dek_key_version SMALLINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        erased_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_patient_channel_active
        ON ai_conversation_threads (patient_id, channel)
        WHERE status = 'active'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_patient
        ON ai_conversation_threads (patient_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_retention
        ON ai_conversation_threads (last_activity_at)
        WHERE status != 'erased'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_conversation_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES ai_conversation_threads(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL,
        seq INT NOT NULL,
        role VARCHAR(16) NOT NULL,
        ciphertext BYTEA NOT NULL,
        nonce BYTEA NOT NULL,
        key_version SMALLINT NOT NULL,
        content_mac CHAR(64) NOT NULL,
        detected_lang VARCHAR(8),
        redaction_flags JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (thread_id, seq)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_thread
        ON ai_conversation_messages (thread_id, seq)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_patient
        ON ai_conversation_messages (patient_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversation_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversation_threads`);
  }
}
