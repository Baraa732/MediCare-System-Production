-- Remove multi-tenant isolation seed data (+963999008XXX phones).
-- Prefer: node tools/dev/seed-mt-isolation-test-data.mjs --clean

-- postgres_clinic / clinic_db
DELETE FROM tenant_staff_assignments
WHERE tenant_id IN (SELECT id FROM tenants WHERE admin_phone_number LIKE '+963999008%');
DELETE FROM tenants WHERE admin_phone_number LIKE '+963999008%';

-- postgres_system / system_db
DELETE FROM clinic_admin_activation_codes WHERE "phoneNumber" LIKE '+963999008%';

-- postgres_user / user_db
DELETE FROM outbox_events
WHERE "aggregateId" IN (SELECT id FROM users WHERE "phoneNumber" LIKE '+963999008%');
DELETE FROM password_history
WHERE user_id IN (SELECT id FROM users WHERE "phoneNumber" LIKE '+963999008%');
DELETE FROM users WHERE "phoneNumber" LIKE '+963999008%';

-- postgres_appointment / appointment_db — run via seed script --clean (resolves clinic IDs)

-- postgres_scheduling / scheduling_db — run via seed script --clean

-- postgres_emr / emr_db — run via seed script --clean
