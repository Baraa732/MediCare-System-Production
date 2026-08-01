import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformDeployments20260801160000 implements MigrationInterface {
  name = 'PlatformDeployments20260801160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_deployments (
        id uuid PRIMARY KEY,
        service varchar NOT NULL,
        version varchar NULL,
        status varchar(32) NOT NULL DEFAULT 'Success',
        actor varchar NULL,
        "startedAt" timestamptz NOT NULL,
        "finishedAt" timestamptz NULL,
        "durationMs" int NULL,
        source varchar(32) NOT NULL DEFAULT 'api',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_platform_deployments_service
      ON platform_deployments (service);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_platform_deployments_started
      ON platform_deployments ("startedAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS platform_deployments`);
  }
}
