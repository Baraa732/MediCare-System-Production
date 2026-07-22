-- MediCare system-manager DB: full clinic provisioning profile on activation codes
-- Apply against system_db when synchronize is disabled.

DO $$ BEGIN
  CREATE TYPE clinic_type_enum AS ENUM (
    'private_clinic',
    'medical_center',
    'dental_clinic',
    'laboratory'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE clinic_admin_activation_codes
  ADD COLUMN IF NOT EXISTS "clinicType" clinic_type_enum NOT NULL DEFAULT 'private_clinic',
  ADD COLUMN IF NOT EXISTS "registrationLicenseNumber" VARCHAR NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "establishmentDate" DATE,
  ADD COLUMN IF NOT EXISTS specialties TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappNumber" VARCHAR NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email VARCHAR,
  ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE,
  ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER,
  ADD COLUMN IF NOT EXISTS documents JSONB;
