import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyAi20250623000002 implements MigrationInterface {
  name = 'MultiTenancyAi20250623000002';

  private readonly tables = [
    'ai_conversation_threads',
    'ai_conversation_messages',
    'ai_conversation_summaries',
    'ai_patient_consents',
    'ai_memory_audit_log',
    'ai_requests',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      if (!(await queryRunner.hasColumn(table, 'tenant_id'))) {
        await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN tenant_id uuid`);
      }
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON ${table}(tenant_id)`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_threads_tenant_patient ON ai_conversation_threads(tenant_id, patient_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_patient ON ai_conversation_messages(tenant_id, patient_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_requests_tenant_user ON ai_requests(tenant_id, user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      if (await queryRunner.hasColumn(table, 'tenant_id')) {
        await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN tenant_id`);
      }
    }
  }
}
