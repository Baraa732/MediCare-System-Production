#!/bin/sh
# Daily pg_dump backup for all MediCare PostgreSQL databases.
set -eu

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

DATE_STAMP="$(date -u +%Y%m%d_%H%M%S)"
DAY_DIR="${BACKUP_ROOT}/${DATE_STAMP}"

DATABASES="auth_db:postgres-auth user_db:postgres-user system_db:postgres-system clinic_db:postgres-clinic scheduling_db:postgres-scheduling notification_db:postgres-notification reminder_db:postgres-reminder evolution_db:postgres-evolution appointment_db:postgres-appointment emr_db:postgres-emr"

mkdir -p "$DAY_DIR"
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[backup] Starting backup run at ${DATE_STAMP}"

for entry in $DATABASES; do
  database="${entry%%:*}"
  host="${entry##*:}"
  output="${DAY_DIR}/${database}.dump"
  echo "[backup] Dumping ${database} from ${host}"
  pg_dump -h "$host" -U "$POSTGRES_USER" -d "$database" -Fc --no-owner --no-acl -f "$output"
  echo "[backup] Wrote ${output}"
done

echo "[backup] Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +

echo "[backup] Completed successfully"
