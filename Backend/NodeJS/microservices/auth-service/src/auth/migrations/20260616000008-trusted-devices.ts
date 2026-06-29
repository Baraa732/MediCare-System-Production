import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrustedDevices20260616000008 implements MigrationInterface {
  name = 'TrustedDevices20260616000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trusted_devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "deviceHash" character varying(128) NOT NULL,
        "deviceLabel" character varying(128),
        "metadata" jsonb,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trusted_devices_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trusted_devices_userId"
      ON "trusted_devices" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trusted_devices_expiresAt"
      ON "trusted_devices" ("expiresAt");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_trusted_devices_user_device_unique"
      ON "trusted_devices" ("userId", "deviceHash");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trusted_devices_user_device_unique";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trusted_devices_expiresAt";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trusted_devices_userId";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trusted_devices";`);
  }
}
