import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforce at most one current session per user.
 * Allows multiple sessions per user as long as only one has is_current=true.
 */
export class CurrentSessionPartialUnique20250602000007 implements MigrationInterface {
  // CREATE INDEX CONCURRENTLY cannot run inside a transaction.
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_one_current_per_user
       ON sessions(user_id)
       WHERE is_current = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_sessions_one_current_per_user`,
    );
  }
}
