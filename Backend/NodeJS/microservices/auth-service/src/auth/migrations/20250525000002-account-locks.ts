import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix 4: Create account_locks table for PostgreSQL fallback when Redis is unavailable.
 * Dual-write pattern: every recordFailedLogin() writes to both Redis (primary) and this table.
 * Reads only happen when Redis is unavailable (fail-safe fallback).
 */
export class AccountLocks20250525000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS account_locks (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        identifier    VARCHAR(64) NOT NULL,
        locked_until  TIMESTAMPTZ,
        tier          VARCHAR(20) NOT NULL DEFAULT 'none',
        failed_attempts INT NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_account_locks_identifier
      ON account_locks(identifier)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_account_locks_identifier`);
    await queryRunner.query(`DROP TABLE IF EXISTS account_locks`);
  }
}
