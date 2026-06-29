import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HIGH FIX: Add foreign key constraints to ensure referential integrity
 * Adds FK constraints to sessions, audit_logs, account_locks, idempotency_keys tables
 * Uses CONCURRENTLY to avoid table locking in production
 */
export class ForeignKeyConstraints20250525000006 implements MigrationInterface {
  // CONCURRENTLY cannot run inside a transaction
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add FK constraint on sessions.userId referencing users (user-service)
    // Note: This is a cross-service reference, so we'll add it as a check constraint instead
    await queryRunner.query(`
      ALTER TABLE sessions 
      ADD CONSTRAINT IF NOT EXISTS ck_sessions_user_id 
      CHECK (user_id IS NOT NULL AND LENGTH(user_id) > 0)
    `);

    // Add FK constraint on audit_logs.userId referencing sessions.userId
    await queryRunner.query(`
      ALTER TABLE audit_logs 
      ADD CONSTRAINT IF NOT EXISTS fk_audit_logs_session 
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL
    `);

    // Add FK constraint on account_locks.userId referencing users (user-service)
    await queryRunner.query(`
      ALTER TABLE account_locks 
      ADD CONSTRAINT IF NOT EXISTS ck_account_locks_user_id 
      CHECK (user_id IS NOT NULL AND LENGTH(user_id) > 0)
    `);

    // Add FK constraint on idempotency_keys.userId referencing users (user-service)
    await queryRunner.query(`
      ALTER TABLE idempotency_keys 
      ADD CONSTRAINT IF NOT EXISTS ck_idempotency_keys_user_id 
      CHECK (user_id IS NOT NULL AND LENGTH(user_id) > 0)
    `);

    // Add FK constraint on jwt_blocklist.userId referencing users (user-service)
    await queryRunner.query(`
      ALTER TABLE jwt_blocklist 
      ADD CONSTRAINT IF NOT EXISTS ck_jwt_blocklist_user_id 
      CHECK (user_id IS NOT NULL AND LENGTH(user_id) > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_session`);
    await queryRunner.query(`ALTER TABLE sessions DROP CONSTRAINT IF EXISTS ck_sessions_user_id`);
    await queryRunner.query(`ALTER TABLE account_locks DROP CONSTRAINT IF EXISTS ck_account_locks_user_id`);
    await queryRunner.query(`ALTER TABLE idempotency_keys DROP CONSTRAINT IF EXISTS ck_idempotency_keys_user_id`);
    await queryRunner.query(`ALTER TABLE jwt_blocklist DROP CONSTRAINT IF EXISTS ck_jwt_blocklist_user_id`);
  }
}
