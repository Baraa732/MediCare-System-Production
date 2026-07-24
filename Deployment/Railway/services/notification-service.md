# notification-service

Multi-channel notifications (incl. WhatsApp via Evolution). Private.

| Field | Value |
|---|---|
| Railway Service Name | `notification-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Backend/NodeJS/microservices/notification-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3009` (pin `PORT=3009`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3009` |
| `DATABASE_HOST` | `postgres-notification.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `notification_db` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `KAFKA_RETRY_COUNT` | `12` |
| `KAFKA_CONNECTION_TIMEOUT` | `15000` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3002` |
| `CLINIC_SERVICE_URL` | `http://clinic-service.railway.internal:3006` |
| `JWT_SECRET` | `<staff-patient-jwt-secret>` — **required** |
| `EVOLUTION_API_URL` | `http://evolution-api.railway.internal:8080` |
| `EVOLUTION_API_KEY` | `<evolution-key>` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.railway.internal:4318` |
| `OTEL_SERVICE_NAME` | `notification-service` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-notification, kafka-1 (+ kafka-init), user-service, clinic-service; Evolution API (WhatsApp, optional).

## Expected health result
`/health/ready` returns `200`; `database` and `kafka` `up`.

## Smoke tests
```bash
curl -f http://notification-service.railway.internal:3009/health/ready
```
Expected: `200`.
