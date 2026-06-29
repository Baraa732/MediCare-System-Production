import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillClinicTenantId20250624000001 implements MigrationInterface {
  name = 'BackfillClinicTenantId20250624000001';

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

    if (await queryRunner.hasColumn('tenant_staff_assignments', 'tenant_id')) {
      await queryRunner.query(`
        INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
        SELECT 'tenant_staff_assignments', id, 'tenant_id is NULL'
        FROM tenant_staff_assignments WHERE tenant_id IS NULL
      `);

      const orphans = await queryRunner.query(`
        SELECT COUNT(*)::int AS count FROM tenant_staff_assignments WHERE tenant_id IS NULL
      `);
      if ((orphans[0]?.count ?? 0) === 0) {
        await queryRunner.query(`
          ALTER TABLE tenant_staff_assignments ALTER COLUMN tenant_id SET NOT NULL
        `);
      }
    }
  }

  public async down(): Promise<void> {}
}
