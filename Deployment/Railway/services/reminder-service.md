# reminder-service

Appointment reminders scheduler. Private.

| Field | Value |
|---|---|
| Railway Service Name | `reminder-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/reminder-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3010` (pin `PORT=3010`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3010` |
| `DATABASE_HOST` | `postgres-reminder.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `reminder_db` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `KAFKA_RETRY_COUNT` | `12` |
| `KAFKA_CONNECTION_TIMEOUT` | `15000` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service.railway.internal:3009` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3002` |
| `CLINIC_SERVICE_URL` | `http://clinic-service.railway.internal:3006` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.railway.internal:4318` |
| `OTEL_SERVICE_NAME` | `reminder-service` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-reminder, kafka-1 (+ kafka-init), notification-service (healthy), user-service, clinic-service.

## Expected health result
`/health/ready` returns `200`; `database` and `kafka` `up`.

## Smoke tests
```bash
curl -f http://reminder-service.railway.internal:3010/health/ready
```
Expected: `200`.
