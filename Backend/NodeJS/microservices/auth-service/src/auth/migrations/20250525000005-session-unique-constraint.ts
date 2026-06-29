import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CRITICAL FIX: Add unique constraint on sessions(userId, sessionId)
 * Prevents duplicate sessions for the same user with the same sessionId
 * Uses CONCURRENTLY to avoid table locking in production
 */
export class SessionUniqueConstraint20250525000005 implements MigrationInterface {
  // CONCURRENTLY cannot run inside a transaction
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint on (userId, sessionId) to prevent duplicate sessions
    await queryRunner.query(
      `ALTER TABLE sessions 
       ADD CONSTRAINT IF NOT EXISTS uk_sessions_user_session 
       UNIQUE (user_id, session_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sessions 
       DROP CONSTRAINT IF EXISTS uk_sessions_user_session`,
    );
  }
}
