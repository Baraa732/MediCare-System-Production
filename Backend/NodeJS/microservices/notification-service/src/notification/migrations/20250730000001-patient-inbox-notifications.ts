import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientInboxNotifications20250730000001 implements MigrationInterface {
  name = 'PatientInboxNotifications20250730000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "patient_inbox_notifications_category_enum" AS ENUM(
          'APPOINTMENT_CONFIRMED',
          'APPOINTMENT_CANCELLED',
          'APPOINTMENT_RESCHEDULED',
          'APPOINTMENT_REMINDER',
          'SYSTEM'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS patient_inbox_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        category "patient_inbox_notifications_category_enum" NOT NULL,
        title VARCHAR NOT NULL,
        body TEXT NOT NULL,
        "appointmentId" VARCHAR,
        "clinicId" VARCHAR,
        data JSONB,
        "readAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_inbox_user_read_created
      ON patient_inbox_notifications("userId", "readAt", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patient_inbox_user_read_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS patient_inbox_notifications`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patient_inbox_notifications_category_enum"`);
  }
}
