import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyAppointments20250623000001 implements MigrationInterface {
  name = 'MultiTenancyAppointments20250623000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('appointments', 'clinicId')) {
      await queryRunner.query(`ALTER TABLE appointments RENAME COLUMN "clinicId" TO tenant_id`);
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_appointments_tenant_created ON appointments(tenant_id, "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('appointments', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE appointments RENAME COLUMN tenant_id TO "clinicId"`);
    }
  }
}
