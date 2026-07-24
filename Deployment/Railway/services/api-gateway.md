# api-gateway

Public edge / reverse proxy for all backend microservices.

| Field | Value |
|---|---|
| Railway Service Name | `api-gateway` |
| Build Context | `./Backend/NodeJS` |
| Dockerfile Path | `api-gateway/Dockerfile` |
| Start Command | *(image default — none required)* |
| Port | `3000` (pin `PORT=3000`) |
| Public / Private | **Public** (generate a Railway domain) |
| Health Check | `GET /health/ready` (liveness: `/health/live`) |

## Required environment variables
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `AUTH_SERVICE_URL` | `http://auth-service.railway.internal:3001` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3002` |
| `SYSTEM_MANAGER_SERVICE_URL` | `http://system-manager-service.railway.internal:3003` |
| `EMR_SERVICE_URL` | `http://emr-service.railway.internal:3004` (only if EMR deployed) |
| `GATEWAY_ROUTES` | *(optional JSON route map; overrides fallbacks)* |
| `ALLOWED_ORIGINS` | `https://<admin-dashboard-domain>,https://<system-dashboard-domain>` |
| `JWT_SECRET` | `<staff-patient-jwt-secret>` |
| `CSRF_SECRET` | `<csrf-secret>` |
| `INTERNAL_SERVICE_TOKEN` | `<internal-token>` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `LOG_LEVEL` | `info` |
| `LOG_FORMAT` | `json` |

## Dependencies
- Redis (rate limiting / sessions)
- auth-service, user-service, system-manager-service (+ emr-service if deployed) — probed by readiness.

## Expected health result
`/health/ready` returns `200` with a JSON body reporting each upstream as reachable.
`/health/live` returns `200` once the process is up.

## Smoke tests
```bash
curl -f https://<gateway-domain>/health/live
curl -f https://<gateway-domain>/health/ready
# Proxy reaches auth:
curl -i https://<gateway-domain>/api/auth/health
```
Expected: `200` on health endpoints; auth route returns auth-service response (not `502`).
