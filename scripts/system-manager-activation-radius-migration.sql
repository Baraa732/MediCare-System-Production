-- MediCare system-manager DB: service coverage radius on activation codes
-- Apply against system_db (postgres-system) when synchronize is disabled.

ALTER TABLE clinic_admin_activation_codes
  ADD COLUMN IF NOT EXISTS "serviceRadiusKm" INTEGER NOT NULL DEFAULT 5;

COMMENT ON COLUMN clinic_admin_activation_codes."serviceRadiusKm" IS 'Clinic service coverage radius in kilometres';
