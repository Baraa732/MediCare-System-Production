# Deployment Order

Derived from `docker-compose.yml` `depends_on`, the Kafka wait-script entrypoint
(`Messaging/Kafka/scripts/wait-for-kafka-broker.sh`), and cross-service `*_SERVICE_URL`
wiring in each service.

Internal hostnames use `http://<service-name>.railway.internal:<PORT>`.

---

## Tiers

### Tier 1 — State (deploy in parallel)
- `postgres-auth`, `postgres-user`, `postgres-system`, `postgres-clinic`,
  `postgres-scheduling`, `postgres-appointment`, `postgres-notification`, `postgres-reminder`
- `postgres-emr`
- Optional: `postgres-evolution`, `postgres-ai`
- `redis`
- `mariadb-openemr`

**Why first:** every microservice opens its own PostgreSQL at boot; auth and gateway also require Redis. Readiness probes fail without them.

### Tier 2 — Messaging (sequential)
1. `zookeeper-1`
2. `kafka-1` (depends on zookeeper)
3. `kafka-init` — one-shot job; run once, then stop

**Why:** All Nest services except `api-gateway` and `ai-service` block on Kafka via the wait script. Topic auto-creation is **disabled** (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`), so `kafka-init` must create topics before services consume/produce.

### Tier 3 — Observability (parallel)
- `jaeger`, `loki`, `prometheus`
- then `otel-collector` (depends on jaeger), `grafana` (depends on prometheus)
- Optional: `alertmanager`, `promtail`

**Why:** Services export OTLP to `otel-collector`. Not strictly blocking (telemetry failures are non-fatal), but deploying first avoids noisy startup errors and gives dashboards immediately.

### Tier 3.5 — Migrations (once per service)
Run each service's migrations against its database before it serves traffic.
For a verified-empty first-deployment database, bootstrap once with
`DB_BOOTSTRAP=true`, then set it to `false` permanently (see `migration-order.md`).

### Tier 4 — Core domain (parallel after Kafka + own DB)
- `auth-service` (postgres-auth, redis, kafka)
- `user-service` (postgres-user, kafka)
- `clinic-service` (postgres-clinic, kafka)
- `openemr` after `mariadb-openemr`, then `emr-service` (postgres-emr, kafka, openemr)
- Optional: `ai-service` (postgres-ai, redis)

### Tier 5 — Scheduling domain
1. `scheduling-service` (postgres-scheduling, kafka, clinic)
2. `appointment-service` (postgres-appointment, kafka; prefers scheduling healthy, clinic, user)

### Tier 6 — Async / notifications
1. `notification-service` (postgres-notification, kafka, user, clinic; **requires JWT_SECRET**)
2. `reminder-service` (postgres-reminder, kafka, notification, user, clinic)

### Tier 7 — Platform
- `system-manager-service` (postgres-system + reads clinic_db & user_db, kafka, clinic, user, auth, notification, api-gateway)

### Tier 8 — Edge (PUBLIC)
- `api-gateway` (redis + all backend `*_SERVICE_URL`). Its `/health/ready` checks auth, user, system-manager, emr.

### Tier 9 — UIs (PUBLIC)
- `clinic-admin-dashboard`, `system-manager-dashboard` (need gateway public URL as build arg)

---

## Service dependency graph

```
postgres-* / redis
        │
zookeeper-1 → kafka-1 → kafka-init
        │
otel/jaeger/prometheus/loki/grafana
        │
auth(redis,kafka)   user(kafka)   clinic(kafka)
        │                │            │
        └────────┬───────┴────────────┘
                 │
        scheduling ←→ appointment
                 │
        notification → reminder
                 │
        system-manager
                 │
          api-gateway → dashboards
```

---

## Parallel deployment groups

| Wave | Deploy together |
|---|---|
| A | All PostgreSQL + Redis |
| B | jaeger + loki + prometheus (then otel-collector + grafana) |
| C | auth + user + clinic + openemr (after its MariaDB) |
| C2 | emr-service (after Kafka, postgres-emr, and openemr are healthy) |
| D | scheduling + appointment (after clinic) |
| E | notification (then reminder) |
| F | system-manager |
| G | api-gateway |
| H | clinic-admin-dashboard + system-manager-dashboard |

## Must wait for

| Service | Waits for |
|---|---|
| kafka-1 | zookeeper-1 |
| kafka-init | kafka-1 healthy |
| any Nest (except gateway, ai) | kafka-1 (+ kafka-init) |
| each Nest | its own PostgreSQL (+ Redis for auth) |
| openemr | mariadb-openemr |
| emr-service | postgres-emr + kafka-init + openemr healthy |
| appointment | scheduling (preferred), clinic, user |
| reminder | notification |
| system-manager | postgres-system + clinic + user DBs, clinic-service |
| api-gateway | auth, user, system-manager (+ emr if deployed) healthy |
| dashboards | api-gateway public URL (build arg) |
