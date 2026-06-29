# MediCare Clinic Management System

Event-driven clinic platform: multi-tenant microservices, role-based dashboards, WhatsApp OTP, scheduling, appointments, and OpenEMR integration.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/stack-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![NestJS](https://img.shields.io/badge/backend-NestJS-E0234E?logo=nestjs)](Backend/NodeJS)
[![React](https://img.shields.io/badge/frontend-React-61DAFB?logo=react&logoColor=black)](Frontend/React)

---

## What this repo is

MediCare is a **clinic operations stack** — not a single CRUD app. Tenants (clinics) get isolated data; staff roles (system manager, clinic admin, secretary, doctor, patient) see different surfaces. Services communicate over **HTTP** (sync) and **Kafka** (async events).

| Layer | Location | Notes |
|--------|-----------|--------|
| API edge | `Backend/NodeJS/api-gateway` | JWT, routing, CORS, tenant headers |
| Domain services | `Backend/NodeJS/microservices/*` | Auth, users, clinics, scheduling, appointments, notifications, reminders, system manager |
| Dashboards | `Frontend/React/*` | Secretary, clinic admin, system manager |
| Integrations | `Integrations/` | WhatsApp (Evolution API), OpenEMR, AI scaffold |
| Messaging | `Messaging/Kafka/` | Topics, shared config |
| Runtime | `docker-compose.yml` | Postgres, Redis, Kafka, observability hooks |

Deep architecture (C4, sequence diagrams, security matrix): **[docs/architecture/ENTERPRISE_ARCHITECTURE.md](docs/architecture/ENTERPRISE_ARCHITECTURE.md)**

---

## Quick start (local)

**Prerequisites:** Docker Desktop, Node 18+, Git.

```bash
git clone https://github.com/Baraa732/MediCare-Project.git
cd MediCare-Project
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, REDIS_PASSWORD, EVOLUTION_API_KEY, etc.

docker compose up -d --build
```

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:3000 |
| System Manager UI (Docker) | http://localhost:3002 |
| Evolution API Manager | http://localhost:8080/manager/ |
| OpenEMR | https://localhost:8081 |

### Local dashboards (Vite)

```bash
# Secretary
cd Frontend/React/secretary-dashboard && npm install && npm run dev   # :5173

# Clinic admin
cd Frontend/React/clinic-admin-dashboard && npm install && npm run dev # :5174
```

Point `VITE_API_BASE_URL` at `http://localhost:3000/api` (or use the dev proxy in each app).

### WhatsApp OTP (dev)

1. Set `EVOLUTION_API_KEY` in `.env`
2. Open Evolution Manager, create/connect instance (e.g. `MedicareTEST`)
3. Scan QR — auth-service sends registration/login codes through Evolution

---

## Repository layout

```
├── Backend/NodeJS/
│   ├── api-gateway/
│   ├── microservices/     # auth, user, clinic, appointment, …
│   └── libs/telemetry/
├── Frontend/React/
│   ├── secretary-dashboard/
│   ├── clinic-admin-dashboard/
│   └── system-manager-dashboard/
├── Integrations/          # WhatsApp, OpenEMR, AI
├── Messaging/Kafka/
├── Database/
├── docker-compose.yml
├── docs/
└── Postman-*.postman_collection.json
```

---

## API collections

Import into Postman for role-scoped flows:

- `Postman-SystemManager-Endpoints.postman_collection.json`
- `Postman-Clinic-Admin-Endpoints.postman_collection.json`
- `Postman-Secretary-Endpoints.postman_collection.json`
- `Postman-Doctor-Endpoints.postman_collection.json`
- `Postman-Patient-Endpoints.postman_collection.json`

---

## Roles at a glance

| Role | Typical surface |
|------|------------------|
| System Manager | Provision clinics, activation codes, platform observability |
| Clinic Admin | Staff, clinic profile, full appointment schedule |
| Secretary | Front-desk booking and day schedule |
| Doctor | Own appointments, encounter workflows (via integrations) |
| Patient | Bookings, OTP verification (mobile/web clients) |

---

## Contributing & security

- [CONTRIBUTING.md](CONTRIBUTING.md) — branches, PR expectations
- [SECURITY.md](SECURITY.md) — how to report issues responsibly

---

## License

[MIT](LICENSE) — see file for full text.

Built by [@Baraa732](https://github.com/Baraa732).
