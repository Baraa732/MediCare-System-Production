import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix 24: Create processed_messages table for Kafka consumer idempotency.
 * Before processing any Kafka message, consumers check this table.
 * If the (messageId, topic) pair already exists, the message is skipped.
 */
export class ProcessedMessages20250525000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS processed_messages (
        message_id   VARCHAR(128) NOT NULL,
        topic        VARCHAR(128) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (message_id, topic)
      )
    `);

    // Index for cleanup cron — delete old processed_messages records
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_messages_processed_at
      ON processed_messages(processed_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_processed_messages_processed_at`);
    await queryRunner.query(`DROP TABLE IF EXISTS processed_messages`);
  }
}
