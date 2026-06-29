import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiBackfillTenantId20250624000001 implements MigrationInterface {
  name = 'AiBackfillTenantId20250624000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_migration_orphans (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        row_id UUID NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_migration_orphans_table_row
      ON tenant_migration_orphans (table_name, row_id)
    `);

    await queryRunner.query(`
      UPDATE ai_conversation_messages m
      SET tenant_id = t.tenant_id
      FROM ai_conversation_threads t
      WHERE m.thread_id = t.id
        AND m.tenant_id IS NULL
        AND t.tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE ai_conversation_summaries s
      SET tenant_id = t.tenant_id
      FROM ai_conversation_threads t
      WHERE s.thread_id = t.id
        AND s.tenant_id IS NULL
        AND t.tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE ai_patient_consents c
      SET tenant_id = sub.tenant_id
      FROM (
        SELECT DISTINCT ON (patient_id) patient_id, tenant_id
        FROM ai_conversation_threads
        WHERE tenant_id IS NOT NULL
        ORDER BY patient_id, last_activity_at DESC NULLS LAST
      ) sub
      WHERE c.patient_id = sub.patient_id
        AND c.tenant_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE ai_memory_audit_log a
      SET tenant_id = sub.tenant_id
      FROM (
        SELECT DISTINCT ON (patient_id) patient_id, tenant_id
        FROM ai_conversation_threads
        WHERE tenant_id IS NOT NULL
        ORDER BY patient_id, last_activity_at DESC NULLS LAST
      ) sub
      WHERE a.patient_id = sub.patient_id
        AND a.tenant_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE ai_requests r
      SET tenant_id = sub.tenant_id
      FROM (
        SELECT DISTINCT ON (patient_id) patient_id, tenant_id
        FROM ai_conversation_threads
        WHERE tenant_id IS NOT NULL
        ORDER BY patient_id, last_activity_at DESC NULLS LAST
      ) sub
      WHERE r.user_id = sub.patient_id
        AND r.tenant_id IS NULL
    `);

    const tables = [
      'ai_conversation_threads',
      'ai_conversation_messages',
      'ai_conversation_summaries',
      'ai_patient_consents',
      'ai_memory_audit_log',
      'ai_requests',
    ];

    for (const table of tables) {
      await queryRunner.query(`
        INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
        SELECT $1, id,
          CASE
            WHEN $1 = 'ai_requests' AND role = 'PATIENT'
              THEN 'tenant_id unresolved — platform patient AI request (no clinic context)'
            ELSE 'tenant_id is NULL after relationship backfill'
          END
        FROM "${table}" t
        WHERE t.tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM tenant_migration_orphans o
            WHERE o.table_name = $1 AND o.row_id = t.id
          )
      `, [table]);
    }

    for (const table of ['ai_conversation_threads', 'ai_conversation_messages', 'ai_conversation_summaries', 'ai_patient_consents', 'ai_memory_audit_log']) {
      const orphans = await queryRunner.query(`
        SELECT COUNT(*)::int AS count FROM "${table}" WHERE tenant_id IS NULL
      `);
      if ((orphans[0]?.count ?? 0) === 0) {
        await queryRunner.query(`
          ALTER TABLE "${table}" ALTER COLUMN tenant_id SET NOT NULL
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'ai_conversation_threads',
      'ai_conversation_messages',
      'ai_conversation_summaries',
      'ai_patient_consents',
      'ai_memory_audit_log',
      'ai_requests',
    ]) {
      if (await queryRunner.hasColumn(table, 'tenant_id')) {
        await queryRunner.query(`
          ALTER TABLE "${table}" ALTER COLUMN tenant_id DROP NOT NULL
        `);
      }
    }
  }
}
