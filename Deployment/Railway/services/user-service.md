# user-service

User profiles & account-linking. Private.

| Field | Value |
|---|---|
| Railway Service Name | `user-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/user-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3002` (pin `PORT=3002`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3002` |
| `DATABASE_HOST` | `postgres-user.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `user_db` |
| `JWT_SECRET` | `<staff-patient-jwt-secret>` |
| `INTERNAL_SERVICE_TOKEN` | `<internal-token>` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-user, kafka-1 (+ kafka-init)

## Expected health result
`/health/ready` returns `200`; reports `database` and `kafka` `up`.

## Smoke tests
```bash
curl -f http://user-service.railway.internal:3002/health/ready
curl -i https://<gateway-domain>/api/users/health
```
Expected: `200`.
