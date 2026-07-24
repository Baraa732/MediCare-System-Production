# system-manager-service

Platform administration (system managers). Bootstraps the default SYSTEM_MANAGER. Private.

| Field | Value |
|---|---|
| Railway Service Name | `system-manager-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/system-manager-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3003` (pin `PORT=3003`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3003` |
| `DATABASE_HOST` | `postgres-system.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `system_db` |
| `JWT_SECRET` | `<system-manager-jwt-secret>` — **must differ from auth-service** |
| `JWT_EXPIRES_IN` | `7d` |
| `INTERNAL_AUTH_SERVICE_NAME` | `system-manager-service` |
| `INTERNAL_AUTH_SECRET` | `<hmac-signing-secret>` |
| `INTERNAL_AUTH_TRUSTED_SECRETS` | `<json/csv trusted secrets map>` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>,https://<system-dashboard-domain>` |
| `DEFAULT_ADMIN_USERNAME` | `<bootstrap-admin-username>` |
| `DEFAULT_ADMIN_PASSWORD` | `<bootstrap-admin-password>` |
| `DEFAULT_ADMIN_FIRST_NAME` | `Admin` (optional) |
| `DEFAULT_ADMIN_LAST_NAME` | `User` (optional) |
| `DEFAULT_ADMIN_EMAIL` | `<optional>` |
| `DEFAULT_ADMIN_PHONE` | `<optional>` |

## Dependencies
- postgres-system (also reads clinic_db & user_db), kafka-1 (+ kafka-init), clinic-service, user-service, auth-service, notification-service, api-gateway.

## Expected health result
`/health/ready` returns `200`; `database` and `kafka` `up`.

## Bootstrap the default system manager
After the service and DB are up, seed once (idempotent, bcrypt cost 12):
```bash
curl -X POST http://system-manager-service.railway.internal:3003/v1/system-manager/dev/seed-default
```
Requires `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` set. Verify a row exists in `system_db.system_managers`.

## Smoke tests
```bash
curl -f http://system-manager-service.railway.internal:3003/health/ready
```
Expected: `200`.
