# scheduling-service

Provider schedules & availability. Private.

| Field | Value |
|---|---|
| Railway Service Name | `scheduling-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/scheduling-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3008` (pin `PORT=3008`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3008` |
| `DATABASE_HOST` | `postgres-scheduling.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `scheduling_db` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `CLINIC_SERVICE_URL` | `http://clinic-service.railway.internal:3006` |
| `APPOINTMENT_SERVICE_URL` | `http://appointment-service.railway.internal:3007` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.railway.internal:4318` |
| `OTEL_SERVICE_NAME` | `scheduling-service` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-scheduling, kafka-1 (+ kafka-init); calls clinic-service. appointment-service depends on this being healthy.

## Expected health result
`/health/ready` returns `200`; `database` and `kafka` `up`.

## Smoke tests
```bash
curl -f http://scheduling-service.railway.internal:3008/health/ready
```
Expected: `200`.
