import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillUsersTenantId20250624000001 implements MigrationInterface {
  name = 'BackfillUsersTenantId20250624000001';

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
      SELECT 'users', id, 'tenant_id is NULL — platform patient or unresolved staff'
      FROM users WHERE tenant_id IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Orphan log retained; users.tenant_id stays nullable for patients
  }
}
