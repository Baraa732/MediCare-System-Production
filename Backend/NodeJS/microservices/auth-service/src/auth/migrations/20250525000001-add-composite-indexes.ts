import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix 28-29: Add composite indexes for sessions and otps tables.
 * Uses CONCURRENTLY to avoid table locking in production.
 * IMPORTANT: TypeORM migrations using CONCURRENTLY must set transaction: false.
 */
export class AddCompositeIndexes20250525000001 implements MigrationInterface {
  // CONCURRENTLY cannot run inside a transaction
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix 28: Composite index on sessions(user_id, status) for revokeAllUserSessions()
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_userid_status
       ON sessions(user_id, status)`,
    );

    // Fix 29: Composite index on otps(phone_number, created_at DESC) for OTP lookups
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_otps_phone_createdat
       ON otps(phone_number, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sessions_userid_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_otps_phone_createdat`);
  }
}
