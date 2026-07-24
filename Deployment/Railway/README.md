# MediCare SaaS — Railway Production Deployment Package

This package lets a DevOps engineer deploy the entire MediCare platform to Railway
**without reading the application source code**. Everything here is derived from the
repository (`docker-compose.yml`, per-service Dockerfiles, `.env.example` files,
`src/main.ts`, health controllers, and migrations).

> Scope: documentation and deployment assets only. No application code, Dockerfiles,
> or docker-compose files are modified by this package.

---

## Contents

```
Deployment/Railway/
├── README.md                     ← this file
├── deployment-order.md           ← tiers, dependencies, parallel groups
├── migration-order.md            ← DB creation + migration execution order
├── post-deployment-tests.md      ← health + smoke + integration tests
├── rollback.md                   ← rollback procedures
├── railway-checklist.md          ← pre-production checklist
├── resources.md                  ← CPU / RAM / storage estimates
├── services/                     ← one file per Railway service
│   ├── api-gateway.md
│   ├── auth-service.md
│   ├── user-service.md
│   ├── clinic-service.md
│   ├── scheduling-service.md
│   ├── appointment-service.md
│   ├── notification-service.md
│   ├── reminder-service.md
│   ├── system-manager-service.md
│   ├── emr-service.md
│   ├── openemr.md
│   ├── ai-service.md             (optional tier, not in docker-compose)
│   ├── clinic-admin-dashboard.md
│   ├── system-manager-dashboard.md
│   ├── redis.md
│   ├── kafka.md
│   ├── zookeeper.md
│   ├── postgres-databases.md
│   ├── otel-collector.md
│   ├── jaeger.md
│   ├── prometheus.md
│   ├── loki.md
│   └── grafana.md
└── env/                          ← one .env.example per deployable service
    ├── api-gateway.env.example
    ├── auth-service.env.example
    ├── user-service.env.example
    ├── clinic-service.env.example
    ├── scheduling-service.env.example
    ├── appointment-service.env.example
    ├── notification-service.env.example
    ├── reminder-service.env.example
    ├── system-manager-service.env.example
    ├── emr-service.env.example
    ├── mariadb-openemr.env.example
    ├── openemr.env.example
    ├── ai-service.env.example
    ├── clinic-admin-dashboard.env.example
    └── system-manager-dashboard.env.example
```

---

## Architecture overview

MediCare is a NestJS microservices SaaS with a **database-per-service** design,
Kafka event bus, Redis, and a full observability stack.

```
                         PUBLIC
            ┌────────────────────────────┐
            │ clinic-admin-dashboard      │
            │ system-manager-dashboard    │
            │ api-gateway  :3000          │
            └─────────────┬──────────────┘
                          │  private DNS  *.railway.internal
   ┌──────────────────────┼───────────────────────────┐
   │ auth:3001  user:3002  clinic:3006  system-mgr:3003 │
   │ scheduling:3008  appointment:3007                  │
   │ notification:3009  reminder:3010  emr:3004 [ai:3005]│
   └──────────────────────┬───────────────────────────┘
                          │
       kafka-1:9092  ← zookeeper-1        redis:6379
                          │
   postgres-auth | user | system | clinic | scheduling |
   appointment | notification | reminder | emr | [ai]
             openemr ← mariadb-openemr
                          │
   Observability: otel-collector · jaeger · prometheus · loki · grafana
```

### Ports (must be pinned on Railway)

| Service | Port |
|---|---|
| api-gateway | 3000 |
| auth-service | 3001 |
| user-service | 3002 |
| system-manager-service | 3003 |
| emr-service | 3004 |
| ai-service | 3005 |
| clinic-service | 3006 |
| appointment-service | 3007 |
| scheduling-service | 3008 |
| notification-service | 3009 |
| reminder-service | 3010 |
| dashboards (nginx) | 80 (set Railway target port to `80`) |

> **Why pin PORT:** each Nest Dockerfile `HEALTHCHECK` probes a hardcoded port
> (`http://localhost:300x/health/ready`). The app binds `process.env.PORT`. If Railway
> injects a different PORT, the container healthcheck fails. Set `PORT` to the value above.

---

## Prerequisites

1. **Railway account** with a project created for MediCare (one environment = one isolated private network).
2. **Private networking** enabled (default on Railway). Services talk over `http://<service-name>.railway.internal:<PORT>`.
3. **Railway CLI** (optional) for scripted deploys and running migrations.
4. **Git repository** connected to Railway. Each Railway service points at the same repo but with a **different Dockerfile path + build context** (see each `services/*.md`).
5. **Secrets prepared** (never committed):
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
   - `JWT_SECRET` (staff/patient) and a **distinct** `JWT_SECRET` for system-manager
   - `INTERNAL_AUTH_SECRET` + `INTERNAL_AUTH_TRUSTED_SECRETS` (HMAC map), `INTERNAL_SERVICE_TOKEN`, `CSRF_SECRET`
   - `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` (system-manager bootstrap)
   - Optional: Evolution / OpenEMR / AI provider keys
6. **Do NOT deploy the repository root** as a service. The root `package.json` is a seed helper, not the platform entrypoint.

---

## Deployment summary

1. Provision databases + Redis (managed).
2. Deploy Zookeeper → Kafka → run `kafka-init` once (topics; auto-create is disabled).
   Build from `Messaging/Kafka/scripts/Dockerfile.kafka-init` (see `services/kafka.md`).
3. Deploy observability (optional) using Railway Dockerfiles under `DevOps/Docker/*/Dockerfile`.
4. Bootstrap each empty database once with `NODE_ENV=production` and
   `DB_BOOTSTRAP=true`, verify its schema, then set `DB_BOOTSTRAP=false` and redeploy.
5. Deploy core → scheduling → async → platform → gateway → dashboards.
6. Run `post-deployment-tests.md`.

See `deployment-order.md` for the exact tiered order and `migration-order.md` for schema setup.

### One-time database bootstrap flag

TypeORM synchronization is controlled only by `DB_BOOTSTRAP`:

```text
DB_BOOTSTRAP=true   # synchronization enabled (first empty DB only)
DB_BOOTSTRAP=false  # synchronization disabled
```

Keep `NODE_ENV=production` during both phases. Set `DB_BOOTSTRAP=true` only for the
first deployment of a service against a verified-empty database. After TypeORM creates
the schema, immediately set `DB_BOOTSTRAP=false` and redeploy. It must remain false
(or unset) permanently for that database and for every future production deployment.
Never enable it against a database containing production data.

For `appointment-service` and `clinic-service`, `migrationsRun` is automatically
disabled while `DB_BOOTSTRAP=true` (TypeORM runs migrations before synchronize).

### Kafka topic init (Railway)

Build `Messaging/Kafka/scripts/Dockerfile.kafka-init` (repo root context). Run once
with `KAFKA_BROKERS=kafka-1.railway.internal:9092` after Kafka is healthy. See
`services/kafka.md`.

### Dashboards

Build with `VITE_API_BASE_URL=https://<api-gateway-public-domain>` (required).
Nginx no longer proxies to Docker DNS. Gateway `ALLOWED_ORIGINS` must include each
dashboard domain.

### Persistent volumes (upload paths)

| Service | Env / path to mount |
|---|---|
| user-service | `AVATAR_UPLOAD_DIR=/usr/src/app/uploads/avatars` |
| clinic-service | `CLINIC_LOGO_UPLOAD_DIR=/usr/src/app/uploads/clinic-logos` |
| system-manager-service | `ACTIVATION_DOCUMENTS_DIR=/usr/src/app/uploads/activation-documents` |

### Observability (optional tier)

Use Railway Dockerfiles that bake configs (no bind mounts):

| Service | Dockerfile |
|---|---|
| otel-collector | `DevOps/Docker/otel/Dockerfile` |
| prometheus | `DevOps/Docker/prometheus/Dockerfile` |
| grafana | `DevOps/Docker/grafana/Dockerfile` |
| loki | `DevOps/Docker/loki/Dockerfile` |
| jaeger | upstream image `jaegertracing/all-in-one:1.57` (no config file) |

Promtail requires a Docker socket — skip on Railway.
