#!/usr/bin/env bash
# Production deployment entrypoint — never loads docker-compose.override.yml.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml"
export MEDICARE_DEPLOY_PROFILE="production"
export MEDICARE_ENV="production"
export STRICT_PRODUCTION_HOST="1"

# ── Load root .env for secret validation ─────────────────────────────────────
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: Required production secret '${name}' is not set."
    echo "       Set it in the project root .env before deploying."
    exit 1
  fi
}

require_env_in_file() {
  local file="$1"
  local name="$2"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Required env file missing: ${file}"
    exit 1
  fi
  if ! grep -qE "^${name}=" "$file"; then
    echo "ERROR: ${name} is missing in ${file}"
    exit 1
  fi
  local value
  value="$(grep -E "^${name}=" "$file" | head -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'' ]*//;s/["'\'' ]*$//')"
  if [[ -z "$value" ]]; then
    echo "ERROR: ${name} is empty in ${file}"
    exit 1
  fi
}

validate_production_secrets() {
  echo "==> Validating production secrets..."

  require_env POSTGRES_USER
  require_env POSTGRES_PASSWORD
  require_env REDIS_PASSWORD
  require_env JWT_SECRET
  require_env KAFKA_EVENT_SIGNING_SECRET
  require_env KAFKA_EVENT_TRUSTED_SECRETS

  if [[ "${DATABASE_SYNCHRONIZE:-false}" == "true" ]]; then
    echo "ERROR: DATABASE_SYNCHRONIZE=true is forbidden in production."
    exit 1
  fi

  require_env_in_file "Backend/NodeJS/microservices/user-service/.env" INTERNAL_AUTH_SERVICE_NAME
  require_env_in_file "Backend/NodeJS/microservices/user-service/.env" INTERNAL_AUTH_SECRET
  require_env_in_file "Backend/NodeJS/api-gateway/.env" INTERNAL_AUTH_TRUSTED_SECRETS

  echo "OK: Production secrets validated."
  bash DevOps/Scripts/validate-secrets.sh
}

reject_override_usage() {
  if [[ "${COMPOSE_FILE:-}" == *override* ]] || [[ "${DOCKER_COMPOSE:-}" == *override* ]]; then
    echo "ERROR: docker-compose.override.yml must not be used for production."
    echo "       Use: docker compose -f docker-compose.yml -f docker-compose.prod.yml"
    exit 1
  fi

  for arg in "$@"; do
    if [[ "$arg" == *override* ]]; then
      echo "ERROR: Production deploy must not reference docker-compose.override.yml."
      exit 1
    fi
  done

  if [[ -f docker-compose.override.yml ]]; then
    accidental="$(docker compose config --format json 2>/dev/null || true)"
    if [[ -n "$accidental" ]] && command -v jq >/dev/null 2>&1; then
      override_redis_ports="$(printf '%s' "$accidental" | jq -r '
        .services.redis.ports // []
        | map(select(.published != null and .published != ""))
        | length
      ')"
      if [[ "${override_redis_ports:-0}" -gt 0 ]]; then
        echo "ERROR: Default docker compose is merging docker-compose.override.yml (Redis exposed)."
        echo "       Set COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml"
        exit 1
      fi
    fi
  fi
}

chmod +x DevOps/scripts/validate-compose-deployment.sh
chmod +x DevOps/scripts/run-production-migrations.sh

validate_production_secrets
reject_override_usage "$@"
./DevOps/scripts/validate-compose-deployment.sh production

if [[ "${1:-}" == "up" ]]; then
  shift
  ./DevOps/scripts/run-production-migrations.sh
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d "$@"
  exit 0
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"
