-- AI DB tenant backfill + performance indexes (idempotent)
-- Run: Get-Content scripts/apply-ai-tenant-migrations.sql | docker exec -i postgres_ai psql -U clinic_user -d ai_db

CREATE TABLE IF NOT EXISTS tenant_migration_orphans (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_migration_orphans_table_row
  ON tenant_migration_orphans (table_name, row_id);

UPDATE ai_conversation_messages m
SET tenant_id = t.tenant_id
FROM ai_conversation_threads t
WHERE m.thread_id = t.id AND m.tenant_id IS NULL AND t.tenant_id IS NOT NULL;

UPDATE ai_conversation_summaries s
SET tenant_id = t.tenant_id
FROM ai_conversation_threads t
WHERE s.thread_id = t.id AND s.tenant_id IS NULL AND t.tenant_id IS NOT NULL;

UPDATE ai_patient_consents c
SET tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, tenant_id
  FROM ai_conversation_threads
  WHERE tenant_id IS NOT NULL
  ORDER BY patient_id, last_activity_at DESC NULLS LAST
) sub
WHERE c.patient_id = sub.patient_id AND c.tenant_id IS NULL;

UPDATE ai_memory_audit_log a
SET tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, tenant_id
  FROM ai_conversation_threads
  WHERE tenant_id IS NOT NULL
  ORDER BY patient_id, last_activity_at DESC NULLS LAST
) sub
WHERE a.patient_id = sub.patient_id AND a.tenant_id IS NULL;

UPDATE ai_requests r
SET tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, tenant_id
  FROM ai_conversation_threads
  WHERE tenant_id IS NOT NULL
  ORDER BY patient_id, last_activity_at DESC NULLS LAST
) sub
WHERE r.user_id = sub.patient_id AND r.tenant_id IS NULL;

INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
SELECT 'ai_conversation_threads', id, 'tenant_id is NULL after relationship backfill'
FROM ai_conversation_threads WHERE tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
SELECT 'ai_conversation_messages', id, 'tenant_id is NULL after relationship backfill'
FROM ai_conversation_messages WHERE tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
SELECT 'ai_conversation_summaries', id, 'tenant_id is NULL after relationship backfill'
FROM ai_conversation_summaries WHERE tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
SELECT 'ai_patient_consents', id, 'tenant_id is NULL after relationship backfill'
FROM ai_patient_consents WHERE tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
SELECT 'ai_memory_audit_log', id, 'tenant_id is NULL after relationship backfill'
FROM ai_memory_audit_log WHERE tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO tenant_migration_orphans (table_name, row_id, reason)
SELECT 'ai_requests', id,
  CASE WHEN role = 'PATIENT'
    THEN 'tenant_id unresolved — platform patient AI request (no clinic context)'
    ELSE 'tenant_id is NULL after relationship backfill'
  END
FROM ai_requests WHERE tenant_id IS NULL
ON CONFLICT DO NOTHING;

DO $$
DECLARE orphan_count INT;
BEGIN
  SELECT COUNT(*)::int INTO orphan_count FROM ai_conversation_threads WHERE tenant_id IS NULL;
  IF orphan_count = 0 THEN ALTER TABLE ai_conversation_threads ALTER COLUMN tenant_id SET NOT NULL; END IF;

  SELECT COUNT(*)::int INTO orphan_count FROM ai_conversation_messages WHERE tenant_id IS NULL;
  IF orphan_count = 0 THEN ALTER TABLE ai_conversation_messages ALTER COLUMN tenant_id SET NOT NULL; END IF;

  SELECT COUNT(*)::int INTO orphan_count FROM ai_conversation_summaries WHERE tenant_id IS NULL;
  IF orphan_count = 0 THEN ALTER TABLE ai_conversation_summaries ALTER COLUMN tenant_id SET NOT NULL; END IF;

  SELECT COUNT(*)::int INTO orphan_count FROM ai_patient_consents WHERE tenant_id IS NULL;
  IF orphan_count = 0 THEN ALTER TABLE ai_patient_consents ALTER COLUMN tenant_id SET NOT NULL; END IF;

  SELECT COUNT(*)::int INTO orphan_count FROM ai_memory_audit_log WHERE tenant_id IS NULL;
  IF orphan_count = 0 THEN ALTER TABLE ai_memory_audit_log ALTER COLUMN tenant_id SET NOT NULL; END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_requests_tenant_created ON ai_requests(tenant_id, created_at) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_threads_tenant_activity ON ai_conversation_threads(tenant_id, last_activity_at) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_created ON ai_conversation_messages(tenant_id, created_at) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_summaries_tenant_created ON ai_conversation_summaries(tenant_id, created_at) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant_created ON ai_memory_audit_log(tenant_id, created_at) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_consents_tenant_patient_scope ON ai_patient_consents(tenant_id, patient_id, scope) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_thread ON ai_conversation_messages(tenant_id, thread_id, seq) WHERE tenant_id IS NOT NULL;
