# PostgreSQL

Database-per-service pattern. Core platform databases (OpenEMR link store is under `Integrations/OpenEMR/Database/PostgreSQL/`).

| Compose service | Database | Used by |
|-----------------|----------|---------|
| `postgres-auth` | `auth_db` | auth-service |
| `postgres-user` | `user_db` | user-service |
| `postgres-system` | `system_db` | system-manager-service |

Credentials: root `.env` → `POSTGRES_USER`, `POSTGRES_PASSWORD`.
