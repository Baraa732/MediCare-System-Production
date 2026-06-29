import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3bSummariesConsentsAudit1730000000002 implements MigrationInterface {
  name = 'Phase3bSummariesConsentsAudit1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES ai_conversation_threads(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL,
        version INT NOT NULL,
        input_seq_from INT NOT NULL,
        input_seq_to INT NOT NULL,
        summary_lang VARCHAR(8) NOT NULL,
        summary_prompt_version VARCHAR(16) NOT NULL,
        ciphertext BYTEA NOT NULL,
        nonce BYTEA NOT NULL,
        key_version SMALLINT NOT NULL,
        source VARCHAR(16) NOT NULL,
        model_id VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        superseded_at TIMESTAMPTZ,
        UNIQUE (thread_id, version)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_summaries_thread
        ON ai_conversation_summaries (thread_id, version)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_summaries_patient
        ON ai_conversation_summaries (patient_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_patient_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        scope VARCHAR(32) NOT NULL,
        granted BOOLEAN NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        ip_hash CHAR(64),
        user_agent_hash CHAR(64),
        version VARCHAR(16) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_consent_patient
        ON ai_patient_consents (patient_id, scope)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_memory_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID,
        actor_id UUID,
        actor_role VARCHAR(32),
        action VARCHAR(64) NOT NULL,
        resource_type VARCHAR(32),
        resource_id UUID,
        reason_code VARCHAR(64),
        correlation_id VARCHAR(64),
        metadata_json JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_patient
        ON ai_memory_audit_log (patient_id, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_memory_audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_patient_consents`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversation_summaries`);
  }
}
