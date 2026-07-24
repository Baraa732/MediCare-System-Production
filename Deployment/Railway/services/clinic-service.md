# clinic-service

Clinic / tenant management. Private.

| Field | Value |
|---|---|
| Railway Service Name | `clinic-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/clinic-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3006` (pin `PORT=3006`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3006` |
| `DATABASE_HOST` | `postgres-clinic.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `clinic_db` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `KAFKA_RETRY_COUNT` | `12` |
| `KAFKA_CONNECTION_TIMEOUT` | `15000` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3002` |
| `SCHEDULING_SERVICE_URL` | `http://scheduling-service.railway.internal:3008` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.railway.internal:4318` |
| `OTEL_SERVICE_NAME` | `clinic-service` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-clinic, kafka-1 (+ kafka-init); calls user-service & scheduling-service.

## Expected health result
`/health/ready` returns `200`; `database` and `kafka` `up`.

## Smoke tests
```bash
curl -f http://clinic-service.railway.internal:3006/health/ready
```
Expected: `200`.
