# Railway Pre-Production Checklist

Work top-to-bottom. Do not promote to production until every box is checked.

## A. Project & networking
- [ ] Railway project created; one environment = one isolated private network.
- [ ] Private networking enabled; services addressed as `<name>.railway.internal`.
- [ ] Repository connected; each service configured with the correct **build context + Dockerfile path** (see `services/*.md`).
- [ ] Repository **root is NOT deployed** as a service.

## B. Secrets (never committed)
- [ ] `POSTGRES_PASSWORD`, `REDIS_PASSWORD` set.
- [ ] Staff/patient `JWT_SECRET` set on auth, user, clinic, appointment, scheduling, notification, EMR, and AI services.
- [ ] `JWT_SECRET` (system manager) set on system-manager-service and **differs** from the staff/patient secret.
- [ ] `CSRF_SECRET`, `INTERNAL_SERVICE_TOKEN` set on gateway.
- [ ] `INTERNAL_AUTH_SERVICE_NAME`, `INTERNAL_AUTH_SECRET`, and valid `INTERNAL_AUTH_TRUSTED_SECRETS` set on every service that uses internal HMAC authentication.
- [ ] `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` set for bootstrap.
- [ ] OpenEMR database, admin, and OAuth credentials set; optional Evolution / AI provider keys set where used.

## C. Ports (pinned)
- [ ] Each Nest service `PORT` pinned to its number (gateway 3000, auth 3001, user 3002, system-manager 3003, emr 3004, ai 3005, clinic 3006, appointment 3007, scheduling 3008, notification 3009, reminder 3010).
- [ ] Dashboard Railway target port is `80`.
- [ ] Container healthchecks match the pinned ports.

## D. State (Tier 1)
- [ ] One PostgreSQL per service provisioned, each with a **dedicated persistent volume**.
- [ ] Redis provisioned (`--requirepass`), persistence enabled if needed.
- [ ] `mariadb-openemr` and `openemr` provisioned with persistent volumes and healthy.
- [ ] `pg_isready` OK for every DB; `redis-cli ping` = `PONG`.

## E. Messaging (Tier 2)
- [ ] `zookeeper-1` up.
- [ ] `kafka-1` up; `KAFKA_ADVERTISED_LISTENERS` = `PLAINTEXT://kafka-1.railway.internal:9092`.
- [ ] `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false` confirmed.
- [ ] `kafka-init` ran once and exited 0; `kafka-topics --list` shows expected topics.

## F. Observability (Tier 3)
- [ ] jaeger, prometheus, loki up; grafana `/api/health` = `200`.
- [ ] otel-collector up; config points at correct downstream hostnames.
- [ ] promtail NOT relied upon (no Docker socket on Railway) — logs via OTel pipeline.
- [ ] `GF_SERVER_ROOT_URL` + dashboard `VITE_GRAFANA_URL` set to Grafana's public domain.

## G. Migrations (Tier 3.5)
- [ ] `NODE_ENV=production` on all services throughout bootstrap and normal operation.
- [ ] `DB_BOOTSTRAP=true` used only for each service's first boot against its verified-empty database.
- [ ] Schema verified, then `DB_BOOTSTRAP=false` set and each service redeployed.
- [ ] `DB_BOOTSTRAP` will never be enabled again for those production databases.
- [ ] `kafka-init` built from `Messaging/Kafka/scripts/Dockerfile.kafka-init` and run once.
- [ ] Dashboard build args use public gateway URL (`VITE_API_BASE_URL=https://...`).
- [ ] Upload volumes mounted at documented paths (avatars, logos, activation docs).
- [ ] Migrations run for every database that uses `migrationsRun` after bootstrap (`migration-order.md`).
- [ ] `migrations` table populated where applicable; key tables verified per service.
- [ ] `clinic_db` and `user_db` migrated/bootstrapped **before** system-manager starts.

## H. Application tiers (4–7)
- [ ] auth, user, clinic healthy (`/health/ready` = 200).
- [ ] scheduling then appointment healthy.
- [ ] notification (JWT_SECRET set) then reminder healthy.
- [ ] system-manager healthy; default manager seeded (idempotent).
- [ ] All `*_SERVICE_URL` values use `*.railway.internal` (no `localhost`).

## I. Edge & UI (8–9)
- [ ] api-gateway public domain generated; `/health/ready` shows upstreams healthy.
- [ ] `ALLOWED_ORIGINS` on gateway includes both dashboard domains.
- [ ] Dashboards built with `VITE_API_BASE_URL=https://<api-gateway-public-domain>`.
- [ ] Dashboard `/health` (admin) and `/` (system) return `200`.

## J. Final
- [ ] `post-deployment-tests.md` end-to-end flow passes.
- [ ] No `5xx` spike in Grafana/Loki; traces visible in Jaeger.
- [ ] `rollback.md` reviewed; DB snapshots taken.
- [ ] Resource limits/reservations set per `resources.md`.
- [ ] Alerting configured (Prometheus/Alertmanager) if in scope.
