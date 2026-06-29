import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix 5: Create jwt_blocklist table for PostgreSQL fallback when Redis is unavailable.
 * Dual-write: addToBlocklist() writes to both Redis and this table.
 * isRevoked() falls back to this table when Redis throws.
 */
export class JwtBlocklist20250525000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS jwt_blocklist (
        jti        VARCHAR(36) PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_jwt_blocklist_expires_at
      ON jwt_blocklist(expires_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_jwt_blocklist_expires_at`);
    await queryRunner.query(`DROP TABLE IF EXISTS jwt_blocklist`);
  }
}
