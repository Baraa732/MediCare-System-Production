import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds service coverage radius (km) to clinic_admin_activation_codes.
 */
export class ActivationCodeServiceRadius20250628000002 implements MigrationInterface {
  name = 'ActivationCodeServiceRadius20250628000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('clinic_admin_activation_codes'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('clinic_admin_activation_codes', 'serviceRadiusKm'))) {
      await queryRunner.query(
        `ALTER TABLE clinic_admin_activation_codes ADD COLUMN "serviceRadiusKm" INTEGER NOT NULL DEFAULT 5`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('clinic_admin_activation_codes'))) {
      return;
    }

    if (await queryRunner.hasColumn('clinic_admin_activation_codes', 'serviceRadiusKm')) {
      await queryRunner.query(
        `ALTER TABLE clinic_admin_activation_codes DROP COLUMN "serviceRadiusKm"`,
      );
    }
  }
}
