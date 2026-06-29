-- Cross-service tenant performance indexes (idempotent)
-- Run per DB: docker exec -i postgres_<service> psql -U clinic_user -d <db> -f -

-- scheduling_db
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_tenant_created ON doctor_schedules(tenant_id, "createdAt") WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_slots_tenant_status ON schedule_slots(tenant_id, status) WHERE tenant_id IS NOT NULL;

-- reminder_db
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_tenant_created ON scheduled_reminders(tenant_id, "createdAt") WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_tenant_status ON scheduled_reminders(tenant_id, status) WHERE tenant_id IS NOT NULL;

-- emr_db
CREATE INDEX IF NOT EXISTS idx_patient_emr_links_tenant_status ON patient_emr_links(tenant_id, "syncStatus") WHERE tenant_id IS NOT NULL;

-- notification_db (supplement)
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_user ON push_device_tokens(tenant_id, user_id) WHERE tenant_id IS NOT NULL;
