-- Minimal tenant suspend cleanup (run per database after clinic is SUSPENDED)
-- Replace :tenant_id with the clinic UUID. No cross-DB FK redesign.
--
-- appointment_db:
--   docker exec -i postgres_appointment psql -U clinic_user -d appointment_db
-- scheduling_db / reminder_db / notification_db / emr_db: same pattern

-- ========== appointment_db ==========
-- Cancel future bookings for suspended clinic (keeps history)
-- UPDATE appointments
-- SET status = 'CANCELLED',
--     cancelled_at = NOW(),
--     cancellation_reason = 'Clinic suspended'
-- WHERE tenant_id = ':tenant_id'
--   AND scheduled_at > NOW()
--   AND status IN ('CONFIRMED', 'REQUESTED');

-- Deactivate doctor-patient assignments for this clinic only
-- UPDATE doctor_patient_assignments
-- SET status = 'REMOVED', updated_at = NOW()
-- WHERE tenant_id = ':tenant_id' AND status = 'ACTIVE';

-- Do NOT delete patient_clinic_relations — shared patients may belong to other clinics

-- ========== reminder_db ==========
-- UPDATE scheduled_reminders
-- SET status = 'CANCELLED', updated_at = NOW()
-- WHERE tenant_id = ':tenant_id' AND status = 'PENDING';

-- ========== emr_db ==========
-- Retain patient_emr_links for audit/PHI retention; access blocked by app when tenant SUSPENDED

-- ========== notification_db ==========
-- No delete required; staff inbox filtered by JWT tenant at read time
