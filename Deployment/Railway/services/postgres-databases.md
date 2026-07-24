# PostgreSQL — database-per-service

MediCare uses **one database per microservice**. On Railway, provision each as a
managed PostgreSQL plugin (recommended) or as a container. Each service connects to
its own instance over the private network.

| Railway Service Name | Database | Used by |
|---|---|---|
| `postgres-auth` | `auth_db` | auth-service |
| `postgres-user` | `user_db` | user-service |
| `postgres-system` | `system_db` | system-manager-service (reads clinic_db, user_db too) |
| `postgres-clinic` | `clinic_db` | clinic-service |
| `postgres-scheduling` | `scheduling_db` | scheduling-service |
| `postgres-appointment` | `appointment_db` | appointment-service |
| `postgres-notification` | `notification_db` | notification-service |
| `postgres-reminder` | `reminder_db` | reminder-service |
| `postgres-emr` *(optional)* | `emr_db` | emr-service |
| `postgres-ai` *(optional)* | `ai_db` | ai-service |

## Common configuration
| Field | Value |
|---|---|
| Image (if container) | `postgres:15-alpine` (matches compose) |
| Port | `5432` |
| Public / Private | **Private** |
| User | `clinic_user` (or Railway-managed user) |
| Password | `<postgres-password>` (secret) |
| Persistent volume | **Required** (`/var/lib/postgresql/data`) |
| Health Check | `pg_isready -U clinic_user` |

## Notes
- Keep `NODE_ENV=production`. Bootstrap each verified-empty database once with
  `DB_BOOTSTRAP=true`, verify it, then set `DB_BOOTSTRAP=false` permanently. See
  `migration-order.md`.
- Give each DB a dedicated volume; never share volumes between services.
- system-manager-service needs **read** access to `clinic_db` and `user_db` in addition to `system_db`; grant a read role or point its cross-DB config at those hosts.

## Smoke test
```bash
pg_isready -h postgres-auth.railway.internal -p 5432 -U clinic_user
```
Expected: `accepting connections`.
