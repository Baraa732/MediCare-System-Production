import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expands clinic_admin_activation_codes with full clinic provisioning profile.
 */
export class ActivationCodeProvisioningProfile20250628000003 implements MigrationInterface {
  name = 'ActivationCodeProvisioningProfile20250628000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('clinic_admin_activation_codes'))) {
      return;
    }

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "clinic_type_enum" AS ENUM (
          'private_clinic',
          'medical_center',
          'dental_clinic',
          'laboratory'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    const addColumn = async (name: string, ddl: string) => {
      if (!(await queryRunner.hasColumn('clinic_admin_activation_codes', name))) {
        await queryRunner.query(
          `ALTER TABLE clinic_admin_activation_codes ADD COLUMN "${name}" ${ddl}`,
        );
      }
    };

    await addColumn('clinicType', `"clinic_type_enum" NOT NULL DEFAULT 'private_clinic'`);
    await addColumn('registrationLicenseNumber', `VARCHAR NOT NULL DEFAULT ''`);
    await addColumn('establishmentDate', `DATE`);
    await addColumn('specialties', `TEXT`);
    await addColumn('whatsappNumber', `VARCHAR NOT NULL DEFAULT ''`);
    await addColumn('email', `VARCHAR`);
    await addColumn('dateOfBirth', `DATE`);
    await addColumn('yearsOfExperience', `INTEGER`);
    await addColumn('documents', `JSONB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('clinic_admin_activation_codes'))) {
      return;
    }

    const dropColumn = async (name: string) => {
      if (await queryRunner.hasColumn('clinic_admin_activation_codes', name)) {
        await queryRunner.query(
          `ALTER TABLE clinic_admin_activation_codes DROP COLUMN "${name}"`,
        );
      }
    };

    await dropColumn('documents');
    await dropColumn('yearsOfExperience');
    await dropColumn('dateOfBirth');
    await dropColumn('email');
    await dropColumn('whatsappNumber');
    await dropColumn('specialties');
    await dropColumn('establishmentDate');
    await dropColumn('registrationLicenseNumber');
    await dropColumn('clinicType');

    await queryRunner.query(`DROP TYPE IF EXISTS "clinic_type_enum"`);
  }
}
