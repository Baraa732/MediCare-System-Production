#!/usr/bin/env bash
# Staging deployment entrypoint — production-like security without dev override.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export COMPOSE_FILE="docker-compose.yml:docker-compose.staging.yml"
export MEDICARE_DEPLOY_PROFILE="staging"
export MEDICARE_ENV="staging"

chmod +x DevOps/scripts/validate-compose-deployment.sh
./DevOps/scripts/validate-compose-deployment.sh staging

docker compose "$@"
