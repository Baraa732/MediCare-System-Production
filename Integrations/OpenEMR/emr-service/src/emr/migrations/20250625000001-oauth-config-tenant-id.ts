import { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthConfigTenantId20250625000001 implements MigrationInterface {
  name = 'OAuthConfigTenantId20250625000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE openemr_oauth_config ADD COLUMN IF NOT EXISTS tenant_id UUID
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_openemr_oauth_config_tenant
      ON openemr_oauth_config(tenant_id)
      WHERE tenant_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_openemr_oauth_config_tenant`);
    if (await queryRunner.hasColumn('openemr_oauth_config', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE openemr_oauth_config DROP COLUMN tenant_id`);
    }
  }
}
