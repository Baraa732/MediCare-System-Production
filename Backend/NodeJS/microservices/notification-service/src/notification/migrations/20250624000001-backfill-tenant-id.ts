import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillNotificationLogsTenantId20250624000001 implements MigrationInterface {
  name = 'BackfillNotificationLogsTenantId20250624000001';

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

    if (await queryRunner.hasColumn('notification_logs', 'tenant_id')) {
      await queryRunner.query(`
        INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
        SELECT 'notification_logs', id, 'tenant_id is NULL'
        FROM notification_logs WHERE tenant_id IS NULL
      `);
    }
  }

  public async down(): Promise<void> {}
}
