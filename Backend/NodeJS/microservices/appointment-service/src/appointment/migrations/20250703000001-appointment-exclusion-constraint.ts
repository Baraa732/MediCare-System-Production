import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentExclusionConstraint20250703000001 implements MigrationInterface {
  name = 'AppointmentExclusionConstraint20250703000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION appointment_slot_epoch_range(
        scheduled_at timestamptz,
        duration_minutes integer
      )
      RETURNS int8range
      LANGUAGE sql
      IMMUTABLE
      AS $$
        SELECT int8range(
          floor(extract(epoch from scheduled_at AT TIME ZONE 'UTC'))::bigint,
          ceil(extract(epoch from ((scheduled_at + (duration_minutes * interval '1 minute')) AT TIME ZONE 'UTC')))::bigint,
          '[)'
        );
      $$;
    `);

    const overlapCount = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM appointments a
      JOIN appointments b
        ON a.tenant_id = b.tenant_id
       AND a."doctorId" = b."doctorId"
       AND a.id < b.id
       AND a.status IN ('REQUESTED'::appointments_status_enum, 'CONFIRMED'::appointments_status_enum)
       AND b.status IN ('REQUESTED'::appointments_status_enum, 'CONFIRMED'::appointments_status_enum)
       AND a."scheduledAt" < b."scheduledAt" + (b."durationMinutes" * interval '1 minute')
       AND b."scheduledAt" < a."scheduledAt" + (a."durationMinutes" * interval '1 minute')
    `);

    if (overlapCount[0]?.count > 0) {
      throw new Error(
        `Cannot add appointments_no_doctor_overlap constraint: ${overlapCount[0].count} overlapping active appointment(s) exist. Resolve conflicts before migrating.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_doctor_overlap
    `);

    await queryRunner.query(`
      ALTER TABLE appointments
        ADD CONSTRAINT appointments_no_doctor_overlap
        EXCLUDE USING gist (
          tenant_id WITH =,
          "doctorId" WITH =,
          appointment_slot_epoch_range("scheduledAt", "durationMinutes") WITH &&
        )
        WHERE (status IN ('REQUESTED'::appointments_status_enum, 'CONFIRMED'::appointments_status_enum))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_doctor_overlap
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS appointment_slot_epoch_range(timestamptz, integer)`);
  }
}
