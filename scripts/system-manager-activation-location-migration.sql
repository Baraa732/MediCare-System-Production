-- MediCare system-manager DB: clinic map coordinates on activation codes
-- Apply against system_db (postgres-system) when synchronize is disabled.

ALTER TABLE clinic_admin_activation_codes
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN clinic_admin_activation_codes.latitude IS 'WGS84 latitude from system manager map pin';
COMMENT ON COLUMN clinic_admin_activation_codes.longitude IS 'WGS84 longitude from system manager map pin';
COMMENT ON COLUMN clinic_admin_activation_codes.address IS 'Optional map-selected address text';
