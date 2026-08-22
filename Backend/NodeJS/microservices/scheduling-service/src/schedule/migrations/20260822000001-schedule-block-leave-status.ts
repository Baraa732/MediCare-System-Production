import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleBlockLeaveStatus20260822000001 implements MigrationInterface {
  name = 'ScheduleBlockLeaveStatus20260822000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_blocks" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'APPROVED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_blocks" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_blocks" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz`,
    );
    await queryRunner.query(
      `UPDATE "schedule_blocks" SET "status" = 'APPROVED' WHERE "status" IS NULL OR "status" = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schedule_blocks" DROP COLUMN IF EXISTS "reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "schedule_blocks" DROP COLUMN IF EXISTS "reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "schedule_blocks" DROP COLUMN IF EXISTS "status"`);
  }
}
