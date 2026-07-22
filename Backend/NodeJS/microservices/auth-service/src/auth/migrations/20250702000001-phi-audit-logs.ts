import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HIPAA-style PHI audit trail — append-only, immutable, searchable.
 * Stores metadata only (no PHI values).
 */
export class PhiAuditLogs20250702000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS phi_audit_logs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp       TIMESTAMPTZ NOT NULL,
        actor_id        UUID,
        actor_role      VARCHAR(64),
        tenant_id       UUID,
        action          VARCHAR(128) NOT NULL,
        resource_type   VARCHAR(64) NOT NULL,
        resource_id     VARCHAR(128),
        ip              VARCHAR(45),
        user_agent      VARCHAR(512),
        request_id      VARCHAR(64),
        success         BOOLEAN NOT NULL,
        classification  VARCHAR(32) NOT NULL,
        source_service  VARCHAR(64),
        internal_call   BOOLEAN NOT NULL DEFAULT false,
        recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_tenant_ts
      ON phi_audit_logs(tenant_id, timestamp DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_actor_ts
      ON phi_audit_logs(actor_id, timestamp DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_resource
      ON phi_audit_logs(resource_type, resource_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_action
      ON phi_audit_logs(action)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_request
      ON phi_audit_logs(request_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_classification
      ON phi_audit_logs(classification)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_phi_audit_timestamp
      ON phi_audit_logs(timestamp DESC)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_phi_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'phi_audit_logs is append-only and immutable';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS phi_audit_logs_immutable ON phi_audit_logs
    `);
    await queryRunner.query(`
      CREATE TRIGGER phi_audit_logs_immutable
      BEFORE UPDATE OR DELETE ON phi_audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_phi_audit_modification()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS phi_audit_logs_immutable ON phi_audit_logs`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_phi_audit_modification()`);
    await queryRunner.query(`DROP TABLE IF EXISTS phi_audit_logs`);
  }
}
