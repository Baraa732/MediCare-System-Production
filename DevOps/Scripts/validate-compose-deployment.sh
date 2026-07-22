#!/usr/bin/env bash
# Validates Docker Compose deployment profiles for MediCare.
# Usage: ./DevOps/scripts/validate-compose-deployment.sh <dev|staging|production>
set -euo pipefail

PROFILE="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f docker-compose.yml ]]; then
  echo "ERROR: docker-compose.yml not found in $ROOT_DIR"
  exit 1
fi

if [[ "$PROFILE" != "dev" && "$PROFILE" != "staging" && "$PROFILE" != "production" ]]; then
  echo "Usage: $0 <dev|staging|production>"
  exit 1
fi

FORBIDDEN_HOST_SERVICES=(
  redis
  mongodb
  mariadb-openemr
  postgres-auth
  postgres-user
  postgres-system
  postgres-clinic
  postgres-scheduling
  postgres-notification
  postgres-reminder
  postgres-appointment
  postgres-evolution
  postgres-emr
  openemr
  evolution-api
  prometheus
  grafana
  loki
  jaeger
  otel-collector
  system-manager-dashboard
  clinic-admin-dashboard
)

REQUIRED_PRODUCTION_ENV_SERVICES=(
  auth-service
  user-service
  emr-service
  clinic-service
  scheduling-service
  appointment-service
  notification-service
  reminder-service
  system-manager-service
  api-gateway
)

compose_config() {
  case "$PROFILE" in
    dev)
      docker compose config --format json
      ;;
    staging)
      docker compose -f docker-compose.yml -f docker-compose.staging.yml config --format json
      ;;
    production)
      docker compose -f docker-compose.yml -f docker-compose.prod.yml config --format json
      ;;
  esac
}

if [[ "$PROFILE" == "production" ]]; then
  if [[ "${COMPOSE_FILE:-}" == *override* ]]; then
    echo "ERROR: COMPOSE_FILE must not include docker-compose.override.yml for production deployments."
    exit 1
  fi

  if [[ "${STRICT_PRODUCTION_HOST:-}" == "1" && -f docker-compose.override.yml ]]; then
    accidental_merge="$(docker compose config --format json 2>/dev/null || true)"
    if [[ -n "$accidental_merge" ]]; then
      override_redis_ports="$(printf '%s' "$accidental_merge" | jq -r '
        .services.redis.ports // []
        | map(select(.published != null and .published != ""))
        | length
      ')"
      if [[ "${override_redis_ports:-0}" -gt 0 ]]; then
        echo "ERROR: docker-compose.override.yml is present on this host and exposes Redis."
        echo "       Remove override from production hosts or set:"
        echo "       COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml"
        exit 1
      fi
    fi
  fi
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for compose deployment validation."
  exit 1
fi

CONFIG_JSON="$(compose_config)"

has_published_port() {
  local service="$1"
  local count
  count="$(printf '%s' "$CONFIG_JSON" | jq -r --arg svc "$service" '
    .services[$svc].ports // []
    | map(select(.published != null and .published != ""))
    | length
  ')"
  [[ "$count" -gt 0 ]]
}

if [[ "$PROFILE" == "staging" || "$PROFILE" == "production" ]]; then
  for service in "${FORBIDDEN_HOST_SERVICES[@]}"; do
    if has_published_port "$service"; then
      echo "ERROR: [$PROFILE] service '$service' publishes host ports — forbidden in $PROFILE."
      exit 1
    fi
  done

  for service in "${REQUIRED_PRODUCTION_ENV_SERVICES[@]}"; do
    node_env="$(printf '%s' "$CONFIG_JSON" | jq -r --arg svc "$service" '.services[$svc].environment.NODE_ENV // empty')"
    if [[ "$node_env" != "production" ]]; then
      echo "ERROR: [$PROFILE] service '$service' must set NODE_ENV=production (found: '${node_env:-<unset>}')."
      exit 1
    fi
  done

  grafana_anon="$(printf '%s' "$CONFIG_JSON" | jq -r '.services.grafana.environment.GF_AUTH_ANONYMOUS_ENABLED // empty')"
  if [[ "$grafana_anon" == "true" ]]; then
    echo "ERROR: [$PROFILE] Grafana anonymous access must be disabled."
    exit 1
  fi
fi

if [[ "$PROFILE" == "dev" ]]; then
  if ! has_published_port "redis"; then
    echo "ERROR: [dev] expected redis host port mapping from docker-compose.override.yml."
    exit 1
  fi
  if ! has_published_port "grafana"; then
    echo "ERROR: [dev] expected grafana host port mapping from docker-compose.override.yml."
    exit 1
  fi
fi

echo "OK: Docker Compose profile '$PROFILE' passed deployment validation."
