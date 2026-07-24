# auth-service

Staff & patient authentication (JWT issuer). Private.

| Field | Value |
|---|---|
| Railway Service Name | `auth-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/auth-service/Dockerfile` |
| Start Command | *(image default — none required)* |
| Port | `3001` (pin `PORT=3001`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_HOST` | `postgres-auth.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `auth_db` |
| `JWT_SECRET` | `<staff-patient-jwt-secret>` — **must differ from system-manager** |
| `JWT_EXPIRES_IN` | `15m` |
| `INTERNAL_SERVICE_TOKEN` | `<internal-token>` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `REDIS_URL` | `redis://:<redis-password>@redis.railway.internal:6379` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |
| `EVOLUTION_API_URL` | `http://evolution-api.railway.internal:8080` (optional) |
| `EVOLUTION_API_KEY` | `<evolution-key>` (optional) |

> `DATABASE_URL` may be used instead of the discrete `DATABASE_*` vars.

## Dependencies
- postgres-auth, redis, kafka-1 (+ kafka-init topics)

## Expected health result
`/health/ready` returns `200` and reports `database`, `redis`, `kafka` all `up`.

## Smoke tests
```bash
# from within the private network (or via gateway)
curl -f http://auth-service.railway.internal:3001/health/ready
curl -i https://<gateway-domain>/api/auth/health
```
Expected: `200` with all dependencies healthy.
