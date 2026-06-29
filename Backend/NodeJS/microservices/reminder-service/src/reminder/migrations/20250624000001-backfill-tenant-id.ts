import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillRemindersTenantId20250624000001 implements MigrationInterface {
  name = 'BackfillRemindersTenantId20250624000001';

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
      INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
      SELECT 'scheduled_reminders', id, 'tenant_id is NULL'
      FROM scheduled_reminders WHERE tenant_id IS NULL
    `);

    const orphans = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM scheduled_reminders WHERE tenant_id IS NULL
    `);
    if ((orphans[0]?.count ?? 0) === 0) {
      await queryRunner.query(`
        ALTER TABLE scheduled_reminders ALTER COLUMN tenant_id SET NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE scheduled_reminders ALTER COLUMN tenant_id DROP NOT NULL
    `);
  }
}
