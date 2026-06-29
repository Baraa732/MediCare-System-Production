import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiTenantPerformanceIndexes20250624000002 implements MigrationInterface {
  name = 'AiTenantPerformanceIndexes20250624000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_requests_tenant_created
      ON ai_requests(tenant_id, created_at)
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_threads_tenant_activity
      ON ai_conversation_threads(tenant_id, last_activity_at)
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_created
      ON ai_conversation_messages(tenant_id, created_at)
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_summaries_tenant_created
      ON ai_conversation_summaries(tenant_id, created_at)
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant_created
      ON ai_memory_audit_log(tenant_id, created_at)
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_consents_tenant_patient_scope
      ON ai_patient_consents(tenant_id, patient_id, scope)
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_thread
      ON ai_conversation_messages(tenant_id, thread_id, seq)
      WHERE tenant_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_requests_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_threads_tenant_activity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_messages_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_summaries_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_audit_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_consents_tenant_patient_scope`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_messages_tenant_thread`);
  }
}
