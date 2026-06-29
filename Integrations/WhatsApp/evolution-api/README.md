# Evolution API

Third-party WhatsApp Business gateway ([Evolution API](https://github.com/EvolutionAPI/evolution-api)).

Runs as a **Docker image** — no custom build in this repo. Configuration is in root `docker-compose.yml`.

## Compose service

| Field | Value |
|-------|-------|
| Service name | `evolution-api` |
| Image | `evoapicloud/evolution-api:v2.3.7` |
| Container | `evolution_api` |
| Port | `8080:8080` |
| Depends on | `postgres-evolution`, `redis` |

## Session persistence (required)

WhatsApp stays connected across container restarts, laptop sleep, and `docker compose down` **only when** all three layers are enabled in `docker-compose.yml`:

1. **PostgreSQL** — `DATABASE_SAVE_DATA_INSTANCE=true` (+ related `DATABASE_SAVE_*` flags)
2. **Redis** — `CACHE_REDIS_SAVE_INSTANCES=true` (credentials cached in Redis DB `6`)
3. **Docker volume** — `evolution_instances:/evolution/instances` (Baileys auth files on disk)

Also set `DEL_INSTANCE=false` so Evolution never auto-deletes instances.

After changing persistence settings, recreate evolution-api and **scan QR once** if the old session was already lost. Future restarts should reconnect automatically.

## Environment (from root `.env`)

| Variable | Purpose |
|----------|---------|
| `EVOLUTION_API_KEY` | API key auth (`AUTHENTICATION_API_KEY`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | PostgreSQL connection for instance + message storage |
| `REDIS_PASSWORD` | Redis cache for WhatsApp session credentials (`CACHE_REDIS_URI`) |

Internal DB URI: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-evolution:5432/evolution_db`

## MediCare client

HTTP integration: `../client/whatsapp.service.ts`  
Consumed by: `auth-service` (OTP, staff credentials, MFA, dev QR endpoints)

## API docs

Evolution API REST docs: connect instance, send text, fetch QR — see upstream project.

Local health check: `http://localhost:8080` (when stack is running)

## Manager UI language (English)

Evolution Manager v2 defaults to Portuguese. This project mounts an English-friendly `index.html` at the **correct** path (`/evolution/manager/dist/index.html`) with asset hashes matching `evoapicloud/evolution-api:v2.3.7`.

**Open the manager (do not use `/instance/undefined/...` bookmarks):**

1. http://localhost:8080/manager/
2. On first visit, enter your **Global API Key** (`EVOLUTION_API_KEY` from root `.env`)
3. Open instance **MedicareTEST** (or `WHATSAPP_INSTANCE_NAME` from auth-service)

If the page hangs or shows `undefined` in the URL, clear site data for `localhost:8080` (localStorage) and open `/manager/` again.

After changing manager files, restart: `docker compose up -d --force-recreate evolution-api`
