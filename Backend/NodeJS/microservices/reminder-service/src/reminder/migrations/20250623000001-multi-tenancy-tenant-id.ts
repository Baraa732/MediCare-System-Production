import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyReminder20250623000001 implements MigrationInterface {
  name = 'MultiTenancyReminder20250623000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('scheduled_reminders', 'clinicId')) {
      await queryRunner.query(`ALTER TABLE scheduled_reminders RENAME COLUMN "clinicId" TO tenant_id`);
    } else if (!(await queryRunner.hasColumn('scheduled_reminders', 'tenant_id'))) {
      await queryRunner.query(`ALTER TABLE scheduled_reminders ADD COLUMN tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'`);
      await queryRunner.query(`ALTER TABLE scheduled_reminders ALTER COLUMN tenant_id DROP DEFAULT`);
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_tenant_id ON scheduled_reminders(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_tenant_status ON scheduled_reminders(tenant_id, status, "remindAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('scheduled_reminders', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE scheduled_reminders RENAME COLUMN tenant_id TO "clinicId"`);
    }
  }
}
