import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyNotification20250623000001 implements MigrationInterface {
  name = 'MultiTenancyNotification20250623000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['notification_logs', 'staff_inbox_notifications']) {
      if (await queryRunner.hasColumn(table, 'clinicId')) {
        await queryRunner.query(`ALTER TABLE "${table}" RENAME COLUMN "clinicId" TO tenant_id`);
      } else if (!(await queryRunner.hasColumn(table, 'tenant_id'))) {
        await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN tenant_id uuid`);
      }
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON "${table}"(tenant_id)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_tenant_created ON "${table}"(tenant_id, "createdAt")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['notification_logs', 'staff_inbox_notifications']) {
      if (await queryRunner.hasColumn(table, 'tenant_id')) {
        await queryRunner.query(`ALTER TABLE "${table}" RENAME COLUMN tenant_id TO "clinicId"`);
      }
    }
  }
}
