# appointment-service

Appointment booking. Private.

| Field | Value |
|---|---|
| Railway Service Name | `appointment-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/appointment-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3007` (pin `PORT=3007`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3007` |
| `DATABASE_HOST` | `postgres-appointment.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `appointment_db` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `KAFKA_RETRY_COUNT` | `12` |
| `KAFKA_CONNECTION_TIMEOUT` | `15000` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3002` |
| `CLINIC_SERVICE_URL` | `http://clinic-service.railway.internal:3006` |
| `SCHEDULING_SERVICE_URL` | `http://scheduling-service.railway.internal:3008` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.railway.internal:4318` |
| `OTEL_SERVICE_NAME` | `appointment-service` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-appointment, kafka-1 (+ kafka-init), scheduling-service (healthy), clinic-service, user-service.

## Expected health result
`/health/ready` returns `200`; `database` and `kafka` `up`.

## Smoke tests
```bash
curl -f http://appointment-service.railway.internal:3007/health/ready
```
Expected: `200`.
