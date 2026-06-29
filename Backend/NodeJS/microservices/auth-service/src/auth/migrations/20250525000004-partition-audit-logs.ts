import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix 18: Convert audit_logs to a range-partitioned table by created_at.
 * Creates monthly partitions for the current month + next 2 months.
 * A scheduled cron job (CleanupTasks.createNextMonthPartition) creates future partitions.
 *
 * NOTE: If audit_logs already has millions of rows in production, use pg_partman
 * for zero-downtime conversion instead of this migration.
 */
export class PartitionAuditLogs20250525000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename existing table to preserve data
    await queryRunner.query(`ALTER TABLE IF EXISTS audit_logs RENAME TO audit_logs_old`);

    // Create new partitioned parent table
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id            UUID NOT NULL DEFAULT gen_random_uuid(),
        user_id       UUID,
        session_id    UUID,
        action        VARCHAR(64) NOT NULL,
        resource      VARCHAR(32) NOT NULL,
        resource_id   UUID,
        request_id    VARCHAR(64),
        ip            VARCHAR(45),
        device        VARCHAR(128),
        risk          VARCHAR(16) DEFAULT 'low',
        metadata      JSONB,
        severity      VARCHAR(16) DEFAULT 'info',
        description   TEXT,
        success       BOOLEAN NOT NULL DEFAULT false,
        error_message TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ) PARTITION BY RANGE (created_at)
    `);

    // Create indexes on parent (inherited by partitions)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);

    // Create partitions for current month and next 2 months
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const name = `audit_logs_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
      const start = d.toISOString().slice(0, 10);
      const end   = e.toISOString().slice(0, 10);
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF audit_logs
         FOR VALUES FROM ('${start}') TO ('${end}')`,
      );
    }

    // Migrate existing data from old table
    await queryRunner.query(`
      INSERT INTO audit_logs SELECT * FROM audit_logs_old
      ON CONFLICT DO NOTHING
    `);

    // Drop old table after successful migration
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs_old`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: recreate unpartitioned table and restore data
    await queryRunner.query(`
      CREATE TABLE audit_logs_restore AS SELECT * FROM audit_logs
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs CASCADE`);
    await queryRunner.query(`ALTER TABLE audit_logs_restore RENAME TO audit_logs`);
  }
}
