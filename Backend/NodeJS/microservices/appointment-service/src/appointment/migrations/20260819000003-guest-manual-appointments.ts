import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuestManualAppointments20260819000003 implements MigrationInterface {
  name = 'GuestManualAppointments20260819000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ALTER COLUMN "patientId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN "guestPatientName" text
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN "guestPatientPhone" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN "guestPatientPhone"
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN "guestPatientName"
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ALTER COLUMN "patientId" SET NOT NULL
    `);
  }
}
