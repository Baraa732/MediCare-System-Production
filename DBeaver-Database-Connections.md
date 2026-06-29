# MediCare — DBeaver Database Connections

Guide for connecting **DBeaver Desktop** to all databases used by the MediCare clinic management system (local Docker development).

> **Credentials source:** root `.env` and service `.env` files in this repo. Values below match the current **development** setup.

---

## Before you connect (important)

By default, `docker-compose.yml` uses **`expose`** (Docker network only). DBeaver on your Windows machine cannot reach the databases until you **publish ports to localhost**.

### Option A — Recommended: `docker-compose.override.yml`

Create `docker-compose.override.yml` next to `docker-compose.yml` with:

```yaml
services:
  postgres-auth:
    ports: ["5433:5432"]
  postgres-user:
    ports: ["5434:5432"]
  postgres-system:
    ports: ["5435:5432"]
  postgres-clinic:
    ports: ["5436:5432"]
  postgres-scheduling:
    ports: ["5437:5432"]
  postgres-notification:
    ports: ["5438:5432"]
  postgres-reminder:
    ports: ["5439:5432"]
  postgres-appointment:
    ports: ["5440:5432"]
  postgres-ai:
    ports: ["5441:5432"]
  postgres-emr:
    ports: ["5442:5432"]
  mariadb-openemr:
    ports: ["3308:3306"]
  mongodb:
    ports: ["27018:27017"]
  redis:
    ports: ["6380:6379"]
```

Then restart:

```powershell
cd "C:\Users\Baraa\Desktop\test routing\MediCare Project 1\clinic-management-system"
docker compose down
docker compose up -d
```

### Option B — One-off port forward (no file change)

Example for auth DB only:

```powershell
docker run --rm -d --name dbeaver-auth-tunnel --network clinic-management-system_clinic_network -p 5433:5432 alpine/socat TCP-LISTEN:5432,fork TCP:postgres-auth:5432
```

Use Option A for a stable setup with all databases.

---

## Shared credentials

| Variable | Value | Used by |
|----------|-------|---------|
| `POSTGRES_USER` | `clinic_user` | All PostgreSQL databases |
| `POSTGRES_PASSWORD` | `MediCareDev2026!` | All PostgreSQL databases |
| `REDIS_PASSWORD` | `MediCareRedis2026!` | Redis |
| `MONGO_USER` | `mongo_admin` | MongoDB (root) |
| `MONGO_PASSWORD` | `MediCareMongo2026!` | MongoDB (root) |
| `OPENEMR_MYSQL_USER` | `openemr` | OpenEMR MariaDB |
| `OPENEMR_MYSQL_PASSWORD` | `OpenEmrDb2026!` | OpenEMR MariaDB |
| `OPENEMR_MYSQL_ROOT_PASSWORD` | `OpenEmrRoot2026!` | OpenEMR MariaDB (root) |

**DBeaver host:** always `localhost` (after port mapping above).

**SSL:** disable for local dev.

---

## Quick reference — all databases

| # | DBeaver connection name | Type | Host port | Database | Username | Password | Microservice |
|---|-------------------------|------|-----------|----------|----------|----------|--------------|
| 1 | MediCare — Auth | PostgreSQL | 5433 | `auth_db` | `clinic_user` | `MediCareDev2026!` | auth-service |
| 2 | MediCare — User | PostgreSQL | 5434 | `user_db` | `clinic_user` | `MediCareDev2026!` | user-service |
| 3 | MediCare — System | PostgreSQL | 5435 | `system_db` | `clinic_user` | `MediCareDev2026!` | system-manager-service |
| 4 | MediCare — Clinic | PostgreSQL | 5436 | `clinic_db` | `clinic_user` | `MediCareDev2026!` | clinic-service |
| 5 | MediCare — Scheduling | PostgreSQL | 5437 | `scheduling_db` | `clinic_user` | `MediCareDev2026!` | scheduling-service |
| 6 | MediCare — Notification | PostgreSQL | 5438 | `notification_db` | `clinic_user` | `MediCareDev2026!` | notification-service |
| 7 | MediCare — Reminder | PostgreSQL | 5439 | `reminder_db` | `clinic_user` | `MediCareDev2026!` | reminder-service |
| 8 | MediCare — Appointment | PostgreSQL | 5440 | `appointment_db` | `clinic_user` | `MediCareDev2026!` | appointment-service |
| 9 | MediCare — AI | PostgreSQL | 5441 | `ai_db` | `clinic_user` | `MediCareDev2026!` | ai-service |
| 10 | MediCare — EMR | PostgreSQL | 5442 | `emr_db` | `clinic_user` | `MediCareDev2026!` | emr-service |
| 11 | MediCare — OpenEMR (MariaDB) | MariaDB / MySQL | 3308 | `openemr` | `openemr` | `OpenEmrDb2026!` | openemr + emr-service |
| 12 | MediCare — Evolution (MongoDB) | MongoDB | 27018 | `evolution` | `mongo_admin` | `MediCareMongo2026!` | evolution-api |
| 13 | MediCare — Redis | Redis | 6380 | `0` | *(none)* | `MediCareRedis2026!` | auth, ai, api-gateway |

**Docker container names:** `postgres_auth`, `postgres_user`, `postgres_system`, `postgres_clinic`, `postgres_scheduling`, `postgres_notification`, `postgres_reminder`, `postgres_appointment`, `postgres_ai`, `postgres_emr`, `mariadb_openemr`, `evolution_mongo`, `redis`.

---

## PostgreSQL connections (10 databases)

Use the same steps for each row in the table above; only **port** and **database name** change.

### DBeaver steps

1. **Database → New Database Connection**
2. Select **PostgreSQL**
3. **Main** tab:
   - **Host:** `localhost`
   - **Port:** see table (e.g. `5433` for auth)
   - **Database:** e.g. `auth_db`
   - **Username:** `clinic_user`
   - **Password:** `MediCareDev2026!`
   - Check **Save password**
4. **Driver properties** (optional): leave defaults
5. **SSL** tab: disable SSL
6. **Test Connection** → **Finish**

### JDBC URLs

```
jdbc:postgresql://localhost:5433/auth_db
jdbc:postgresql://localhost:5434/user_db
jdbc:postgresql://localhost:5435/system_db
jdbc:postgresql://localhost:5436/clinic_db
jdbc:postgresql://localhost:5437/scheduling_db
jdbc:postgresql://localhost:5438/notification_db
jdbc:postgresql://localhost:5439/reminder_db
jdbc:postgresql://localhost:5440/appointment_db
jdbc:postgresql://localhost:5441/ai_db
jdbc:postgresql://localhost:5442/emr_db
```

User/password for all: `clinic_user` / `MediCareDev2026!`

### What each PostgreSQL DB contains

| Database | Purpose |
|----------|---------|
| `auth_db` | Users auth, sessions, MFA, trusted devices, audit logs, JWT blocklist |
| `user_db` | User profiles, roles, staff/patient records |
| `system_db` | System manager accounts, clinic admin activation codes |
| `clinic_db` | Clinics, departments, staff assignments |
| `scheduling_db` | Doctor schedules, availability, time slots |
| `appointment_db` | Appointments, status, booking data |
| `notification_db` | Notification templates, delivery logs |
| `reminder_db` | Appointment reminder jobs and state |
| `ai_db` | AI chat history, prompts, cache metadata |
| `emr_db` | EMR integration sync state (OpenEMR bridge) |

---

## MariaDB — OpenEMR

OpenEMR’s primary EHR data lives in MariaDB (not in the `emr_db` PostgreSQL DB).

### DBeaver steps

1. **New Database Connection → MariaDB** (or MySQL if MariaDB driver unavailable)
2. **Main** tab:
   - **Host:** `localhost`
   - **Port:** `3308`
   - **Database:** `openemr`
   - **Username:** `openemr`
   - **Password:** `OpenEmrDb2026!`
3. **Test Connection** → **Finish**

### Root access (optional)

- **Username:** `root`
- **Password:** `OpenEmrRoot2026!`

### JDBC URL

```
jdbc:mariadb://localhost:3308/openemr
```

**OpenEMR web UI:** https://localhost:8081 (admin: `admin` / `pass` from `.env`)

---

## MongoDB — Evolution API (WhatsApp)

Evolution API stores WhatsApp session/instance data in MongoDB.

### DBeaver steps

1. **New Database Connection → MongoDB**
2. **Main** tab:
   - **Host:** `localhost`
   - **Port:** `27018`
   - **Database:** `evolution`
   - **Authentication:** enabled
   - **User name:** `mongo_admin`
   - **Password:** `MediCareMongo2026!`
   - **Authentication database:** `admin`
3. **Test Connection** → **Finish**

### Connection string

```
mongodb://mongo_admin:MediCareMongo2026!@localhost:27018/evolution?authSource=admin
```

---

## Redis

Used for caching, rate limiting, and session-related data (auth-service, ai-service, api-gateway).

### DBeaver steps

1. **New Database Connection → Redis**
2. **Main** tab:
   - **Host:** `localhost`
   - **Port:** `6380`
   - **Password:** `MediCareRedis2026!`
   - **Database index:** `0`
3. **Test Connection** → **Finish**

### CLI equivalent

```powershell
redis-cli -h localhost -p 6380 -a MediCareRedis2026! ping
```

---

## DBeaver project setup tip

Create a **MediCare** folder in DBeaver and add all 13 connections with consistent naming:

```
MediCare/
├── 01 Auth (PostgreSQL)
├── 02 User (PostgreSQL)
├── 03 System (PostgreSQL)
├── 04 Clinic (PostgreSQL)
├── 05 Scheduling (PostgreSQL)
├── 06 Notification (PostgreSQL)
├── 07 Reminder (PostgreSQL)
├── 08 Appointment (PostgreSQL)
├── 09 AI (PostgreSQL)
├── 10 EMR (PostgreSQL)
├── 11 OpenEMR (MariaDB)
├── 12 Evolution WhatsApp (MongoDB)
└── 13 Redis
```

Color-code PostgreSQL connections the same way for easier browsing.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Connection refused** on `localhost` | Stack not running: `docker compose up -d`. Ports not published: add `docker-compose.override.yml` and restart. |
| **Password authentication failed** | Confirm root `.env` values. After changing `.env`, recreate DB volumes or update passwords inside containers. |
| **Port already in use** | Change host port in override (e.g. `54333:5432`). Update DBeaver connection to match. |
| **PostgreSQL “database does not exist”** | Use exact name from table (`auth_db`, not `auth`). |
| **MongoDB auth failed** | Set **Authentication database** to `admin`, not `evolution`. |
| **MariaDB access denied for `openemr`** | Use app user `openemr` / `OpenEmrDb2026!`, or root with `OpenEmrRoot2026!`. |

### Verify containers are healthy

```powershell
docker compose ps
docker compose logs postgres-auth --tail 20
```

---

## Not connectable via DBeaver (by design)

These run in Docker but are **not SQL databases**:

| Service | Purpose | Notes |
|---------|---------|-------|
| **Kafka** (`kafka_1:9092`) | Event bus between microservices | Use Kafka UI / CLI, not DBeaver |
| **Zookeeper** (`zookeeper_1:2181`) | Kafka coordination | Same as above |
| **Ollama** (`localhost:11434`) | Local LLM API | HTTP API, not a DB |

---

## Security note

Credentials in this document are **development-only** from the project `.env`. Do not use them in production. Do not commit real production secrets to git.

If you rotate passwords in `.env`, update every DBeaver connection and restart affected containers:

```powershell
docker compose up -d --force-recreate
```
