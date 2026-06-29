import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmrBackfillTenantId20250624000001 implements MigrationInterface {
  name = 'EmrBackfillTenantId20250624000001';

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
      SELECT 'patient_emr_links', id, 'tenant_id is NULL — cannot resolve from legacy clinicId'
      FROM patient_emr_links
      WHERE tenant_id IS NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_patient_emr_links_userId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_8f4a2b1c3d4e5f6a7b8c9d0e1f"
    `);

    const hasUserIdUnique = await queryRunner.query(`
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'patient_emr_links'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%userId%'
        AND pg_get_constraintdef(oid) NOT LIKE '%tenant_id%'
      LIMIT 1
    `);
    if (hasUserIdUnique?.length) {
      const constraintName = hasUserIdUnique[0]?.conname;
      if (constraintName) {
        await queryRunner.query(
          `ALTER TABLE patient_emr_links DROP CONSTRAINT IF EXISTS "${constraintName}"`,
        );
      }
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_emr_links_tenant_user
      ON patient_emr_links (tenant_id, "userId")
      WHERE tenant_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_emr_links_tenant_openemr
      ON patient_emr_links (tenant_id, "openemrPatientId")
      WHERE tenant_id IS NOT NULL AND "openemrPatientId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_patient_emr_links_tenant_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patient_emr_links_tenant_openemr`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_migration_orphans`);
  }
}
