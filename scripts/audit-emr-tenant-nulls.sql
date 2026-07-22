-- emr_db: audit and minimal cleanup for patient_emr_links.tenant_id IS NULL
-- Run: docker exec -i postgres_emr psql -U clinic_user -d emr_db -f -

\echo '=== NULL tenant_id count ==='
SELECT COUNT(*) AS null_tenant_links FROM patient_emr_links WHERE tenant_id IS NULL;

\echo '=== NULL tenant_id breakdown ==='
SELECT sync_status, COUNT(*) AS cnt
FROM patient_emr_links
WHERE tenant_id IS NULL
GROUP BY sync_status
ORDER BY cnt DESC;

\echo '=== Safe cleanup: failed/pending junk with no OpenEMR id ==='
-- Review before uncommenting DELETE:
-- DELETE FROM patient_emr_links
-- WHERE tenant_id IS NULL
--   AND openemr_patient_id IS NULL
--   AND sync_status IN ('FAILED', 'PENDING');

\echo '=== Orphans already logged ==='
SELECT COUNT(*) AS orphan_log_rows
FROM tenant_migration_orphans
WHERE table_name = 'patient_emr_links';
