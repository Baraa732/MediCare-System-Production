import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffActivationFields20250604000001 implements MigrationInterface {
  name = 'StaffActivationFields20250604000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "users_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';
    `).catch(() => {
      // enum type name may differ; fallback for fresh DBs with synchronize
    });

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "username" character varying UNIQUE,
        ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "activationExpiresAt" TIMESTAMP WITH TIME ZONE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "activationExpiresAt",
        DROP COLUMN IF EXISTS "mustChangePassword",
        DROP COLUMN IF EXISTS "username";
    `);
  }
}
