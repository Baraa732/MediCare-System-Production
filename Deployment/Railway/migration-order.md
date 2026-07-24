# Migration Order

MediCare uses **TypeORM** with synchronization controlled exclusively by
`DB_BOOTSTRAP`. Keep `NODE_ENV=production`. For the first deployment only, set
`DB_BOOTSTRAP=true` against a verified-empty database so TypeORM creates the base
schema. Verify the schema, then set `DB_BOOTSTRAP=false` and redeploy before serving
traffic. Never enable the flag again for that database.

### TypeORM order (verified against installed TypeORM)
`migrationsRun` executes **before** `synchronize`. Therefore
`appointment-service` and `clinic-service` set:

```text
migrationsRun: process.env.DB_BOOTSTRAP !== 'true'
synchronize: process.env.DB_BOOTSTRAP === 'true'
```

During bootstrap: synchronize only. After bootstrap: auto-migrations only.

---

## 1. Database creation order

Create databases first (Tier 1). Order among them does not matter — they are
independent — but all must exist before their service migrates.

| # | Database | Owner service |
|---|---|---|
| 1 | `auth_db` | auth-service |
| 2 | `user_db` | user-service |
| 3 | `clinic_db` | clinic-service |
| 4 | `scheduling_db` | scheduling-service |
| 5 | `appointment_db` | appointment-service |
| 6 | `notification_db` | notification-service |
| 7 | `reminder_db` | reminder-service |
| 8 | `system_db` | system-manager-service |
| 9 | `emr_db` *(optional)* | emr-service |
| 10 | `ai_db` *(optional)* | ai-service |

Each: `CREATE DATABASE <name>;` owned by `clinic_user` (or the Railway managed user).

---

## 2. Migration execution order

Run each service's migrations against **its own** database. Follow the domain
dependency order so downstream data contracts exist first:

1. `auth-service` → `auth_db`
2. `user-service` → `user_db`
3. `clinic-service` → `clinic_db`
4. `scheduling-service` → `scheduling_db`
5. `appointment-service` → `appointment_db`
6. `notification-service` → `notification_db`
7. `reminder-service` → `reminder_db`
8. `system-manager-service` → `system_db`
9. *(optional)* `emr-service` → `emr_db`
10. *(optional)* `ai-service` → `ai_db`

### How to run
Run each service's TypeORM migration command inside a Railway one-off shell/job for that
service (image already contains `dist` + `node_modules`), for example:
```bash
# from the service container / one-off command
npm run migration:run
# or, if the project exposes the TypeORM CLI:
npx typeorm migration:run -d dist/data-source.js
```
> Confirm the exact script name in each service's `package.json` (`migration:run` /
> `typeorm:run`). Do not modify code — just invoke the existing script.

### Special case: system-manager bootstrap
After `system_db` is migrated and system-manager-service is up, seed the default
platform manager (idempotent):
```bash
curl -X POST http://system-manager-service.railway.internal:3003/v1/system-manager/dev/seed-default
```
Requires `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD`.

### Cross-database reads
`system-manager-service` reads `clinic_db` and `user_db` in addition to `system_db`.
Ensure those two are migrated **before** system-manager starts.

---

## 3. Verification after each migration

After each `migration:run`, verify:

```sql
-- migrations recorded
SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;

-- expected tables exist (spot check)
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Then confirm the service becomes ready:
```bash
curl -f http://<service>.railway.internal:<port>/health/ready
```
Expected: `200` with `database: up`.

| Service | Key table to spot-check |
|---|---|
| auth-service | `users` / `auth_credentials` |
| user-service | `user_profiles` |
| clinic-service | `clinics` |
| scheduling-service | `schedules` / `availability` |
| appointment-service | `appointments` |
| notification-service | `notifications` |
| reminder-service | `reminders` |
| system-manager-service | `system_managers` |

> Table names are indicative; the authoritative list is whatever the migrations create.
> The `migrations` bookkeeping table and a `200` from `/health/ready` are the definitive
> success signals.

---

## 4. Rerun / idempotency
- TypeORM skips already-applied migrations (tracked in the `migrations` table); rerunning is safe.
- The system-manager seed endpoint is idempotent (checks username before insert).
- `kafka-init` topic creation is separate from DB migrations — see `services/kafka.md`.
