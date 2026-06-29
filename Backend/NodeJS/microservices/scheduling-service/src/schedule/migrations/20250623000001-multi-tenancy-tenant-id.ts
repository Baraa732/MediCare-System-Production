import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyScheduling20250623000001 implements MigrationInterface {
  name = 'MultiTenancyScheduling20250623000001';

  private async renameClinicColumn(queryRunner: QueryRunner, table: string): Promise<void> {
    if (await queryRunner.hasColumn(table, 'clinicId')) {
      await queryRunner.query(`ALTER TABLE "${table}" RENAME COLUMN "clinicId" TO tenant_id`);
    } else if (!(await queryRunner.hasColumn(table, 'tenant_id'))) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN tenant_id uuid`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['clinic_hours', 'doctor_availability', 'schedule_blocks']) {
      await this.renameClinicColumn(queryRunner, table);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON "${table}"(tenant_id)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['clinic_hours', 'doctor_availability', 'schedule_blocks']) {
      if (await queryRunner.hasColumn(table, 'tenant_id')) {
        await queryRunner.query(`ALTER TABLE "${table}" RENAME COLUMN tenant_id TO "clinicId"`);
      }
    }
  }
}
