#!/usr/bin/env bash
# Validates production secrets and rejects known development placeholders.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_MODE="${MEDICARE_ENV:-${NODE_ENV:-development}}"
STRICT="${STRICT_PRODUCTION_HOST:-0}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: Required secret '${name}' is not set."
    exit 1
  fi
}

reject_dev_secret() {
  local label="$1"
  local value="$2"
  local patterns=(
    'MediCareDev2026!'
    'MediCareRedis2026!'
    'MediCareJwtSecretMin32CharsForDevOnly!!'
    'MediCareSystemManagerJwtSecretDev2026!!'
    'your-super-secret-jwt-key-change-in-production'
    'changeme'
    'replace-me'
  )

  if [[ "$ENV_MODE" == "production" || "$STRICT" == "1" ]]; then
    for pattern in "${patterns[@]}"; do
      if [[ "$value" == *"$pattern"* ]]; then
        echo "ERROR: ${label} uses a known development placeholder value."
        exit 1
      fi
    done
  fi
}

validate_root_env() {
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi

  require_env POSTGRES_USER
  require_env POSTGRES_PASSWORD
  require_env REDIS_PASSWORD
  require_env JWT_SECRET
  require_env KAFKA_EVENT_SIGNING_SECRET
  require_env KAFKA_EVENT_TRUSTED_SECRETS

  reject_dev_secret POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
  reject_dev_secret REDIS_PASSWORD "$REDIS_PASSWORD"
  reject_dev_secret JWT_SECRET "$JWT_SECRET"
  reject_dev_secret KAFKA_EVENT_SIGNING_SECRET "$KAFKA_EVENT_SIGNING_SECRET"
}

validate_service_env_files() {
  local files=(
    "Backend/NodeJS/api-gateway/.env"
    "Backend/NodeJS/microservices/auth-service/.env"
    "Backend/NodeJS/microservices/user-service/.env"
    "Backend/NodeJS/microservices/system-manager-service/.env"
    "Backend/NodeJS/microservices/clinic-service/.env"
    "Backend/NodeJS/microservices/scheduling-service/.env"
    "Backend/NodeJS/microservices/appointment-service/.env"
    "Backend/NodeJS/microservices/notification-service/.env"
    "Backend/NodeJS/microservices/reminder-service/.env"
    "Integrations/OpenEMR/emr-service/.env"
  )

  local required_keys=(
    INTERNAL_AUTH_SECRET
    JWT_SECRET
  )

  for file in "${files[@]}"; do
    if [[ ! -f "$file" ]]; then
      echo "WARN: Missing optional env file: ${file}"
      continue
    fi

    for key in "${required_keys[@]}"; do
      if ! grep -qE "^${key}=" "$file"; then
        echo "WARN: ${key} missing in ${file}"
        continue
      fi
      local value
      value="$(grep -E "^${key}=" "$file" | head -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'' ]*//;s/["'\'' ]*$//')"
      if [[ -z "$value" ]]; then
        echo "ERROR: ${key} is empty in ${file}"
        exit 1
      fi
      reject_dev_secret "${file}:${key}" "$value"
    done
  done
}

echo "==> Running secret hygiene audit (mode=${ENV_MODE})"
validate_root_env
validate_service_env_files
echo "OK: Secret hygiene audit passed"
