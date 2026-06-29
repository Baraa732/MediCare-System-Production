import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiTenancyEmr20250623000001 implements MigrationInterface {
  name = 'MultiTenancyEmr20250623000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('patient_emr_links', 'tenant_id'))) {
      await queryRunner.query(`ALTER TABLE patient_emr_links ADD COLUMN tenant_id uuid`);
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_patient_emr_links_tenant_id ON patient_emr_links(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_patient_emr_links_tenant_user ON patient_emr_links(tenant_id, "userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('patient_emr_links', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE patient_emr_links DROP COLUMN tenant_id`);
    }
  }
}
