-- Multi-tenancy migrations (idempotent where possible)
-- Run per database via: docker exec -i postgres_<name> psql -U clinic_user -d <db> -f -

-- ========== clinic_db ==========
-- \c clinic_db
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinics') THEN
    ALTER TABLE clinic_staff_assignments DROP CONSTRAINT IF EXISTS "FK_0f8045734dbbfc603c8b685c11e";
    ALTER TABLE clinics RENAME TO tenants;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinic_staff_assignments') THEN
    ALTER TABLE clinic_staff_assignments RENAME TO tenant_staff_assignments;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_staff_assignments' AND column_name = 'clinicId'
  ) THEN
    ALTER TABLE tenant_staff_assignments RENAME COLUMN "clinicId" TO tenant_id;
  END IF;
END $$;

ALTER TABLE tenant_staff_assignments
  DROP CONSTRAINT IF EXISTS fk_tsa_tenant;
ALTER TABLE tenant_staff_assignments
  ADD CONSTRAINT fk_tsa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
UPDATE tenants SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) NOT NULL DEFAULT 'standard';
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tsa_tenant_id ON tenant_staff_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tsa_user_status ON tenant_staff_assignments(user_id, status);

-- ========== user_db ==========
-- users.clinicId -> tenant_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'clinicId'
  ) THEN
    ALTER TABLE users RENAME COLUMN "clinicId" TO tenant_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id UUID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users(tenant_id, status);

-- ========== appointment_db ==========
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'clinicId'
  ) THEN
    ALTER TABLE appointments RENAME COLUMN "clinicId" TO tenant_id;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_created ON appointments(tenant_id, "createdAt");

-- ========== scheduling_db ==========
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctor_schedules' AND column_name = 'clinicId') THEN
    ALTER TABLE doctor_schedules RENAME COLUMN "clinicId" TO tenant_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_exceptions' AND column_name = 'clinicId') THEN
    ALTER TABLE schedule_exceptions RENAME COLUMN "clinicId" TO tenant_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_slots' AND column_name = 'clinicId') THEN
    ALTER TABLE schedule_slots RENAME COLUMN "clinicId" TO tenant_id;
  END IF;
END $$;

-- ========== notification_db ==========
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_logs' AND column_name = 'clinicId') THEN
    ALTER TABLE notification_logs RENAME COLUMN "clinicId" TO tenant_id;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE notification_logs ADD COLUMN tenant_id uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_inbox_notifications' AND column_name = 'clinicId') THEN
    ALTER TABLE staff_inbox_notifications RENAME COLUMN "clinicId" TO tenant_id;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_inbox_notifications' AND column_name = 'tenant_id') THEN
    ALTER TABLE staff_inbox_notifications ADD COLUMN tenant_id uuid;
  END IF;
END $$;

-- ========== reminder_db ==========
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_reminders' AND column_name = 'clinicId') THEN
    ALTER TABLE scheduled_reminders RENAME COLUMN "clinicId" TO tenant_id;
  END IF;
END $$;

-- ========== emr_db ==========
ALTER TABLE patient_emr_links ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_patient_emr_links_tenant_id ON patient_emr_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_emr_links_tenant_user ON patient_emr_links(tenant_id, "userId");

-- ========== ai_db ==========
ALTER TABLE ai_conversation_threads ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE ai_conversation_messages ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE ai_conversation_summaries ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE ai_patient_consents ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE ai_memory_audit_log ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE ai_requests ADD COLUMN IF NOT EXISTS tenant_id uuid;
