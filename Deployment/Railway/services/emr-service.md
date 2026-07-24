# emr-service

OpenEMR integration bridge. Private.

| Field | Value |
|---|---|
| Railway Service Name | `emr-service` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `./Integrations/OpenEMR/emr-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3004` (pin `PORT=3004`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3004` |
| `DATABASE_HOST` | `postgres-emr.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `emr_db` |
| `KAFKA_BROKERS` | `kafka-1.railway.internal:9092` |
| `JWT_SECRET` | `<staff-patient-jwt-secret>` |
| `INTERNAL_SERVICE_TOKEN` | `<internal-service-token-min-24-chars>` |
| `INTERNAL_AUTH_SERVICE_NAME` | `emr-service` |
| `INTERNAL_AUTH_SECRET` | `<emr-signing-secret-min-24-chars>` |
| `INTERNAL_AUTH_TRUSTED_SECRETS` | `<JSON caller-to-secret map>` |
| `OPENEMR_BASE_URL` | `http://openemr.railway.internal` |
| `OPENEMR_SITE` | `default` |
| `OPENEMR_ADMIN_USER` | `<openemr-admin-user>` |
| `OPENEMR_ADMIN_PASSWORD` | `<openemr-admin-password>` |
| `OPENEMR_CLIENT_ID` | `<openemr-oauth-client-id>` |
| `OPENEMR_CLIENT_SECRET` | `<openemr-oauth-client-secret>` |
| `OPENEMR_MYSQL_HOST` | `mariadb-openemr.railway.internal` |
| `OPENEMR_MYSQL_USER` | `openemr` |
| `OPENEMR_MYSQL_PASSWORD` | `<openemr-mysql-password>` |
| `OPENEMR_MYSQL_DATABASE` | `openemr` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.railway.internal:4318` |
| `OTEL_SERVICE_NAME` | `emr-service` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

Use `env/emr-service.env.example`.

## Dependencies
- postgres-emr, kafka-1 (+ kafka-init), openemr, mariadb-openemr.

## Expected health result
`/health/ready` returns `200`.

## Smoke tests
```bash
curl -f http://emr-service.railway.internal:3004/health/ready
curl -i https://<gateway-domain>/api/emr/health
```
Expected: `200`.
