# Evolution API

Third-party WhatsApp Business gateway ([Evolution API](https://github.com/EvolutionAPI/evolution-api)).

Runs as a **Docker image** — no custom build in this repo. Configuration is in root `docker-compose.yml`.

## Compose service

| Field | Value |
|-------|-------|
| Service name | `evolution-api` |
| Image | `atendai/evolution-api:v1.8.7` |
| Container | `evolution_api` |
| Port | `8080:8080` |
| Depends on | `mongodb` (healthy) |

## Environment (from root `.env`)

| Variable | Purpose |
|----------|---------|
| `EVOLUTION_API_KEY` | API key auth (`AUTHENTICATION_API_KEY`) |
| `MONGO_USER` / `MONGO_PASSWORD` | MongoDB connection for instance state |

Internal URI: `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongodb:27017/evolution?authSource=admin`

## MediCare client

HTTP integration: `../client/whatsapp.service.ts`  
Consumed by: `auth-service` (OTP, staff credentials, MFA, dev QR endpoints)

## API docs

Evolution API REST docs: connect instance, send text, fetch QR — see upstream project.

Local health check: `http://localhost:8080` (when stack is running)

## Manager UI language (English)

Evolution Manager v1 defaults to Portuguese. This project mounts an English `index.html`:

- File: `manager/index.html` → sets `localStorage.locale = 'en'`
- URL: http://localhost:8080/manager/clinic-management

After changing, restart: `docker compose up -d evolution-api`

You can still switch language from the globe icon in the manager top bar (en / pt / es).
