import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 identity: extend tenant_staff_assignments for multi-clinic staff.
 */
export class TenantStaffAssignmentPhase120250706000001 implements MigrationInterface {
  name = 'TenantStaffAssignmentPhase120250706000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tenant_staff_assignments'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('tenant_staff_assignments', 'is_primary'))) {
      await queryRunner.query(`
        ALTER TABLE tenant_staff_assignments
          ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE
      `);
    }

    if (!(await queryRunner.hasColumn('tenant_staff_assignments', 'started_at'))) {
      await queryRunner.query(`
        ALTER TABLE tenant_staff_assignments
          ADD COLUMN started_at TIMESTAMPTZ NULL
      `);
    }

    if (!(await queryRunner.hasColumn('tenant_staff_assignments', 'ended_at'))) {
      await queryRunner.query(`
        ALTER TABLE tenant_staff_assignments
          ADD COLUMN ended_at TIMESTAMPTZ NULL
      `);
    }

    if (!(await queryRunner.hasColumn('tenant_staff_assignments', 'invitation_id'))) {
      await queryRunner.query(`
        ALTER TABLE tenant_staff_assignments
          ADD COLUMN invitation_id UUID NULL
      `);
    }

    await queryRunner.query(`
      UPDATE tenant_staff_assignments
      SET status = 'ENDED'
      WHERE status = 'INACTIVE'
    `);

    await queryRunner.query(`
      UPDATE tenant_staff_assignments
      SET ended_at = updated_at
      WHERE status = 'ENDED' AND ended_at IS NULL
    `);

    await queryRunner.query(`
      UPDATE tenant_staff_assignments
      SET started_at = assigned_at
      WHERE status = 'ACTIVE' AND started_at IS NULL
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY assigned_at ASC) AS rn
        FROM tenant_staff_assignments
        WHERE status = 'ACTIVE'
      )
      UPDATE tenant_staff_assignments t
      SET is_primary = TRUE
      FROM ranked r
      WHERE t.id = r.id AND r.rn = 1
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tsa_user_primary
      ON tenant_staff_assignments (user_id)
      WHERE is_primary = TRUE AND status = 'ACTIVE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tenant_staff_assignments'))) {
      return;
    }

    await queryRunner.query(`DROP INDEX IF EXISTS idx_tsa_user_primary`);

    await queryRunner.query(`
      UPDATE tenant_staff_assignments
      SET status = 'INACTIVE'
      WHERE status = 'ENDED'
    `);

    if (await queryRunner.hasColumn('tenant_staff_assignments', 'invitation_id')) {
      await queryRunner.query(`ALTER TABLE tenant_staff_assignments DROP COLUMN invitation_id`);
    }
    if (await queryRunner.hasColumn('tenant_staff_assignments', 'ended_at')) {
      await queryRunner.query(`ALTER TABLE tenant_staff_assignments DROP COLUMN ended_at`);
    }
    if (await queryRunner.hasColumn('tenant_staff_assignments', 'started_at')) {
      await queryRunner.query(`ALTER TABLE tenant_staff_assignments DROP COLUMN started_at`);
    }
    if (await queryRunner.hasColumn('tenant_staff_assignments', 'is_primary')) {
      await queryRunner.query(`ALTER TABLE tenant_staff_assignments DROP COLUMN is_primary`);
    }
  }
}
