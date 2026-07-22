-- Remove E2E seed data (+963999009XXX phones).
-- Prefer: node tools/dev/seed-e2e-test-data.mjs --clean
-- Or run each block against the matching postgres container.

-- postgres_clinic / clinic_db
DELETE FROM tenant_staff_assignments
WHERE tenant_id IN (SELECT id FROM tenants WHERE admin_phone_number LIKE '+963999009%');
DELETE FROM tenants WHERE admin_phone_number LIKE '+963999009%';

-- postgres_system / system_db
DELETE FROM clinic_admin_activation_codes WHERE "phoneNumber" LIKE '+963999009%';

-- postgres_user / user_db
DELETE FROM password_history
WHERE user_id IN (SELECT id FROM users WHERE "phoneNumber" LIKE '+963999009%');
DELETE FROM users WHERE "phoneNumber" LIKE '+963999009%';

-- postgres_appointment / appointment_db
-- Run AFTER clinic/user cleanup, or use seed script --clean (resolves clinic IDs dynamically).
