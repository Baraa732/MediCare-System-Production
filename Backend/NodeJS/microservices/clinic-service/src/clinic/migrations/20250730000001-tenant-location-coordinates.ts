import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantLocationCoordinates20250730000001 implements MigrationInterface {
  name = 'TenantLocationCoordinates20250730000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('tenants', 'latitude'))) {
      await queryRunner.query(
        `ALTER TABLE tenants ADD COLUMN latitude DOUBLE PRECISION`,
      );
    }
    if (!(await queryRunner.hasColumn('tenants', 'longitude'))) {
      await queryRunner.query(
        `ALTER TABLE tenants ADD COLUMN longitude DOUBLE PRECISION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('tenants', 'longitude')) {
      await queryRunner.query(`ALTER TABLE tenants DROP COLUMN longitude`);
    }
    if (await queryRunner.hasColumn('tenants', 'latitude')) {
      await queryRunner.query(`ALTER TABLE tenants DROP COLUMN latitude`);
    }
  }
}
