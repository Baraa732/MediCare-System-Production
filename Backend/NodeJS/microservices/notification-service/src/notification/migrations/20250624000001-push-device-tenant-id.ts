import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPushTenantId20250624000001 implements MigrationInterface {
  name = 'NotificationPushTenantId20250624000001';

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

    if (!(await queryRunner.hasColumn('push_device_tokens', 'tenant_id'))) {
      await queryRunner.query(`ALTER TABLE push_device_tokens ADD COLUMN tenant_id UUID`);
    }

    await queryRunner.query(`
      INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
      SELECT 'push_device_tokens', id, 'tenant_id is NULL — will be set on next device registration'
      FROM push_device_tokens
      WHERE tenant_id IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_push_device_tokens_tenant_id
      ON push_device_tokens(tenant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_push_device_tokens_tenant_user
      ON push_device_tokens(tenant_id, "userId")
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_push_device_tokens_userId_fcmToken"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_push_device_tokens_tenant_user_token
      ON push_device_tokens(tenant_id, "userId", "fcmToken")
      WHERE tenant_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_push_device_tokens_tenant_user_token`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_push_device_tokens_tenant_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_push_device_tokens_tenant_id`);
    if (await queryRunner.hasColumn('push_device_tokens', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE push_device_tokens DROP COLUMN tenant_id`);
    }
  }
}
