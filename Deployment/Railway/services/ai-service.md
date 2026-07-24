# ai-service (OPTIONAL tier — not defined in docker-compose.yml)

AI assistant microservice. A Dockerfile exists at
`Integrations/AI/ai-service/Dockerfile`, but there is **no service entry in
`docker-compose.yml`**, so values below are the documented defaults for the
service (port `3005`). Confirm against the AI service's own `.env(.example)`
before enabling this tier.

| Field | Value |
|---|---|
| Railway Service Name | `ai-service` |
| Build Context | `.` (repo root) *(verify)* |
| Dockerfile Path | `./Integrations/AI/ai-service/Dockerfile` |
| Start Command | *(image default)* |
| Port | `3005` (pin `PORT=3005`) |
| Public / Private | **Private** |
| Health Check | `GET /health/ready` (verify path exists) |

> Note: this service's Dockerfile reinstalls `node_modules` in the production
> stage (it is not a shared-build service like the other Nest services).

## Required environment variables (verify against repo)
| Var | Example / Placeholder |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3005` |
| `DATABASE_HOST` | `postgres-ai.railway.internal` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `clinic_user` |
| `DATABASE_PASSWORD` | `<postgres-password>` |
| `DATABASE_NAME` | `ai_db` |
| `REDIS_URL` | `redis://:<redis-password>@redis.railway.internal:6379` |
| `AI_PROVIDER_API_KEY` | `<llm-provider-key>` |
| `ALLOWED_ORIGINS` | `https://<gateway-domain>` |

## Dependencies
- postgres-ai, redis (+ AI provider API).

## Expected health result
`/health/ready` returns `200` (confirm endpoint exists in the AI service).

## Smoke tests
```bash
curl -f http://ai-service.railway.internal:3005/health/ready
```
Expected: `200`.
