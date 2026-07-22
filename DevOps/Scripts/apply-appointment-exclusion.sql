CREATE EXTENSION IF NOT EXISTS btree_gist;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM appointments a
    JOIN appointments b
      ON a.tenant_id = b.tenant_id
     AND a."doctorId" = b."doctorId"
     AND a.id < b.id
     AND a.status IN ('REQUESTED'::appointments_status_enum, 'CONFIRMED'::appointments_status_enum)
     AND b.status IN ('REQUESTED'::appointments_status_enum, 'CONFIRMED'::appointments_status_enum)
     AND a."scheduledAt" < b."scheduledAt" + (b."durationMinutes" * interval '1 minute')
     AND b."scheduledAt" < a."scheduledAt" + (a."durationMinutes" * interval '1 minute')
  ) THEN
    RAISE EXCEPTION 'Overlapping active appointments exist';
  END IF;
END $$;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_no_doctor_overlap;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_doctor_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    "doctorId" WITH =,
    appointment_slot_epoch_range("scheduledAt", "durationMinutes") WITH &&
  )
  WHERE (status IN ('REQUESTED'::appointments_status_enum, 'CONFIRMED'::appointments_status_enum));
