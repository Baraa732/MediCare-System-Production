import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix 14: Create password_history table to prevent password reuse.
 * Stores the last N password hashes per user. changePassword() and
 * resetPasswordInternal() check against this table before accepting a new password.
 */
export class PasswordHistory20250525000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_history (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_history_user_created
      ON password_history(user_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_password_history_user_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS password_history`);
  }
}
