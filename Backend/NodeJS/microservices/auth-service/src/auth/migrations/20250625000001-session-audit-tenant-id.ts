import { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionAuditTenantId20250625000001 implements MigrationInterface {
  name = 'SessionAuditTenantId20250625000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tenant_id UUID
    `);
    await queryRunner.query(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_tenant_status_expires
      ON sessions(tenant_id, status, "expiresAt")
      WHERE tenant_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
      ON audit_logs(tenant_id, "createdAt")
      WHERE tenant_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_tenant_status_expires`);
    if (await queryRunner.hasColumn('audit_logs', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN tenant_id`);
    }
    if (await queryRunner.hasColumn('sessions', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE sessions DROP COLUMN tenant_id`);
    }
  }
}
