# OpenEMR Integration

All OpenEMR-related code, databases, and docs live in this folder.

## Layout

```
Integrations/OpenEMR/
├── emr-service/              NestJS microservice (:3004) — FHIR sync, chart access
├── Database/
│   ├── PostgreSQL/           emr_db (patient_emr_links)
│   └── MySQL/                OpenEMR MariaDB (clinical data)
└── README.md                 This file
```

## Docker services (in root `docker-compose.yml`)

| Container | Role | Host access |
|-----------|------|-------------|
| `mariadb_openemr` | OpenEMR MariaDB | internal only |
| `openemr` | OpenEMR UI + REST/FHIR APIs | http://localhost:8081 |
| `postgres_emr` | MediCare ↔ OpenEMR link store | internal only |
| `emr_service` | build `Integrations/OpenEMR/emr-service` | internal :3004 |

## Default login (after first boot)

Set in root `.env`:

- `OPENEMR_ADMIN_USER` (default: admin)
- `OPENEMR_ADMIN_PASSWORD`

Open the UI at **http://localhost:8081** and sign in with those credentials.

## Patient auto-sync

When a **PATIENT** user is created in MediCare (registration, admin create, or link-patient flow), `user-service` publishes `user.created` via the outbox. `emr-service` consumes that event and creates a matching FHIR Patient in OpenEMR.

Mapping is stored in `emr_db.patient_emr_links` (`userId` → `openemrPatientId`).

Check sync status (internal):

```http
GET http://emr-service:3004/internal/emr/patient/{userId}
x-service-token: <INTERNAL_SERVICE_TOKEN>
```

## Environment variables (root `.env`)

```
OPENEMR_MYSQL_ROOT_PASSWORD=
OPENEMR_MYSQL_USER=openemr
OPENEMR_MYSQL_PASSWORD=
OPENEMR_ADMIN_USER=admin
OPENEMR_ADMIN_PASSWORD=
```

Service-specific: `Integrations/OpenEMR/emr-service/.env` (OAuth client, internal token).

## First startup

OpenEMR can take **3–5 minutes** on first run (DB install + site setup). Wait until:

```bash
docker compose ps openemr
# STATUS: healthy
```

Then start or restart `emr-service` if it started before OpenEMR was ready.

## APIs enabled automatically

These globals are set via Docker env (`OPENEMR_SETTING_*`):

- Standard REST API
- FHIR REST API
- OAuth2 password grant (dev/integration only)

Production should use a dedicated OAuth client with `OPENEMR_CLIENT_ID` / `OPENEMR_CLIENT_SECRET` in `Integrations/OpenEMR/emr-service/.env`.

## Public API

Gateway route: `http://localhost:3000/api/emr/*` → emr-service `/v1/emr/*`
