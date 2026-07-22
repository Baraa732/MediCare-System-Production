#!/usr/bin/env bash
# Run TypeORM migrations for production-critical services before app startup.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "${COMPOSE_FILE:-}" ]]; then
  IFS=':' read -r -a COMPOSE_FILE_PARTS <<< "${COMPOSE_FILE}"
  COMPOSE=(docker compose)
  for part in "${COMPOSE_FILE_PARTS[@]}"; do
    COMPOSE+=(-f "$part")
  done
elif [[ "${MEDICARE_DEPLOY_PROFILE:-}" == "production" ]]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
elif [[ -f docker-compose.override.yml ]]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.override.yml)
else
  COMPOSE=(docker compose -f docker-compose.yml)
fi

MIGRATION_SERVICES=(
  auth-service
  appointment-service
  notification-service
  reminder-service
)

POSTGRES_SERVICES=(
  postgres-auth
  postgres-appointment
  postgres-notification
  postgres-reminder
)

echo "==> Using compose: ${COMPOSE[*]}"
echo "==> Building migration service images..."
"${COMPOSE[@]}" build "${MIGRATION_SERVICES[@]}"

echo "==> Starting PostgreSQL dependencies..."
"${COMPOSE[@]}" up -d --wait "${POSTGRES_SERVICES[@]}"

baseline_auth_migrations_if_synced() {
  local pg_user="${POSTGRES_USER:-clinic_user}"
  echo "==> Baseline auth migrations when schema already exists (synchronize/dev stacks)"
  "${COMPOSE[@]}" exec -T postgres-auth psql -U "${pg_user}" -d auth_db <<'SQL'
INSERT INTO auth_migrations (timestamp, name)
SELECT v.ts, v.name
FROM (VALUES
  (20250525000001, 'AddCompositeIndexes20250525000001'),
  (20250525000002, 'AccountLocks20250525000002'),
  (20250525000003, 'JwtBlocklist20250525000003'),
  (20250525000004, 'PartitionAuditLogs20250525000004'),
  (20250525000005, 'SessionUniqueConstraint20250525000005'),
  (20250525000006, 'ForeignKeyConstraints20250525000006'),
  (20250602000007, 'CurrentSessionPartialUnique20250602000007'),
  (20260616000008, 'TrustedDevices20260616000008'),
  (20250625000001, 'SessionAuditTenantId20250625000001')
) AS v(ts, name)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'sessions'
)
AND NOT EXISTS (
  SELECT 1 FROM auth_migrations m WHERE m.name = v.name
);
SQL
}

run_service_migration() {
  local service="$1"
  echo "==> Running migrations: ${service}"
  if ! "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh "${service}" \
    -c 'node ./node_modules/typeorm/cli.js migration:run -d dist/typeorm-data-source.js'; then
    echo "ERROR: Migration failed for ${service}"
    exit 1
  fi
}

for service in "${MIGRATION_SERVICES[@]}"; do
  if [[ "${service}" == "auth-service" ]]; then
    baseline_auth_migrations_if_synced
  fi
  run_service_migration "${service}"
done

echo "OK: Production migrations completed successfully."
