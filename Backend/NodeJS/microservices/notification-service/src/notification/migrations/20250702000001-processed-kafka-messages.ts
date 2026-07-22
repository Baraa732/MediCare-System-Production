import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcessedKafkaMessages20250702000001 implements MigrationInterface {
  name = 'ProcessedKafkaMessages20250702000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS processed_kafka_messages (
        message_id VARCHAR(128) NOT NULL,
        topic VARCHAR(128) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (message_id, topic)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_kafka_messages_processed_at
      ON processed_kafka_messages (processed_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS processed_kafka_messages`);
  }
}
