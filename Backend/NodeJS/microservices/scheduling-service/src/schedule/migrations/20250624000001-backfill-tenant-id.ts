import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillSchedulingTenantId20250624000001 implements MigrationInterface {
  name = 'BackfillSchedulingTenantId20250624000001';

  private readonly tables = ['doctor_schedules', 'schedule_exceptions', 'schedule_slots'];

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

    for (const table of this.tables) {
      if (!(await queryRunner.hasColumn(table, 'tenant_id'))) continue;

      await queryRunner.query(`
        INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
        SELECT $1, id, 'tenant_id is NULL'
        FROM "${table}" WHERE tenant_id IS NULL
      `, [table]);

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

  public async down(): Promise<void> {
    // keep nullable on rollback
  }
}
