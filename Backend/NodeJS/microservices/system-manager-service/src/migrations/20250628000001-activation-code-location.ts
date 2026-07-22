import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds map coordinates to clinic_admin_activation_codes.
 * clinicLocation (existing) remains the human-readable label at code generation.
 */
export class ActivationCodeLocation20250628000001 implements MigrationInterface {
  name = 'ActivationCodeLocation20250628000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('clinic_admin_activation_codes'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('clinic_admin_activation_codes', 'latitude'))) {
      await queryRunner.query(
        `ALTER TABLE clinic_admin_activation_codes ADD COLUMN latitude DOUBLE PRECISION`,
      );
    }

    if (!(await queryRunner.hasColumn('clinic_admin_activation_codes', 'longitude'))) {
      await queryRunner.query(
        `ALTER TABLE clinic_admin_activation_codes ADD COLUMN longitude DOUBLE PRECISION`,
      );
    }

    if (!(await queryRunner.hasColumn('clinic_admin_activation_codes', 'address'))) {
      await queryRunner.query(
        `ALTER TABLE clinic_admin_activation_codes ADD COLUMN address TEXT`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('clinic_admin_activation_codes'))) {
      return;
    }

    if (await queryRunner.hasColumn('clinic_admin_activation_codes', 'address')) {
      await queryRunner.query(`ALTER TABLE clinic_admin_activation_codes DROP COLUMN address`);
    }

    if (await queryRunner.hasColumn('clinic_admin_activation_codes', 'longitude')) {
      await queryRunner.query(`ALTER TABLE clinic_admin_activation_codes DROP COLUMN longitude`);
    }

    if (await queryRunner.hasColumn('clinic_admin_activation_codes', 'latitude')) {
      await queryRunner.query(`ALTER TABLE clinic_admin_activation_codes DROP COLUMN latitude`);
    }
  }
}
