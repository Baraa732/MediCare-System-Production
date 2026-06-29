# MediCare AI Integration

Local AI service powered by **Ollama** and **qwen3:4b** for clinical documentation, OCR cleanup, and patient/doctor assistants.

## Architecture

```
Client → API Gateway (:3000/api/ai/*) → ai-service (:3005) → Ollama (:11434)
                                              ↓
                                         PostgreSQL (ai_db)
                                              ↓
                                           Redis (cache + rate limit)
```

This is a standalone microservice — existing auth, user, EMR, and other services are unchanged.

## Quick Start

1. Copy env files and set secrets (match other services):

```bash
cp Integrations/AI/ai-service/.env.example Integrations/AI/ai-service/.env
# Set JWT_SECRET and INTERNAL_SERVICE_TOKEN to match auth-service / api-gateway
```

2. Start the stack (Ollama model pulls automatically via `ollama-init`):

```bash
docker compose up -d --build
```

3. Verify:

```bash
curl http://localhost:3005/health/ready
curl http://localhost:11434/api/tags
```

First startup may take several minutes while `qwen3:4b` downloads (~2.5GB).

## OCR Pipeline

```
Uploaded Image (base64) → Tesseract OCR → AI Cleanup → { rawText, cleanedText, structuredData }
```

Or send pre-extracted `rawText` from mobile on-device OCR.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://ollama:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `qwen3:4b` | Model name |
| `AI_ENABLED` | `true` | Enable/disable AI endpoints |
| `AI_TIMEOUT` | `120000` | Ollama request timeout (ms) |
| `AI_CACHE_TTL_SECONDS` | `3600` | Redis cache TTL |
| `AI_RATE_LIMIT_MAX` | `30` | Max requests per user per window |
| `AI_RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate limit window |
| `REDIS_URL` | — | Redis connection (shared with platform) |
| `JWT_SECRET` | — | Must match auth-service |
| `INTERNAL_SERVICE_TOKEN` | — | Must match gateway |

## API Endpoints (via Gateway)

All require `Authorization: Bearer <JWT>`.

| Method | Path | Roles |
|--------|------|-------|
| POST | `/api/ai/summary` | SECRETARY, DOCTOR, CLINIC_ADMIN, SYSTEM_MANAGER |
| POST | `/api/ai/report` | DOCTOR, SYSTEM_MANAGER |
| POST | `/api/ai/ocr-cleanup` | SECRETARY, CLINIC_ADMIN, SYSTEM_MANAGER |
| POST | `/api/ai/patient-chat` | PATIENT, SYSTEM_MANAGER |
| POST | `/api/ai/doctor-chat` | DOCTOR, CLINIC_ADMIN, SYSTEM_MANAGER |
| POST | `/api/ai/appointment-note` | DOCTOR, SECRETARY, CLINIC_ADMIN, SYSTEM_MANAGER |
| POST | `/api/ai/clinical-assessment` | DOCTOR, SYSTEM_MANAGER |
| POST | `/api/ai/recommendations` | DOCTOR, SYSTEM_MANAGER |
| GET | `/api/ai/status` | DOCTOR, CLINIC_ADMIN, SYSTEM_MANAGER |
| GET | `/api/ai/metrics` | SYSTEM_MANAGER |

Swagger (development): `http://ai-service:3005/api` (direct) or document via gateway.

## Hardware Notes (GTX 1650 4GB / 24GB RAM)

- `qwen3:4b` fits in 4GB VRAM
- Ollama container limit: 8GB RAM, 4 CPUs
- First inference may be slow while model loads into GPU

## Frontend Client

TypeScript client for dashboards and mobile wrappers:

```typescript
import { MediCareAiClient } from '../Integrations/AI/client/ai-api.client';

const ai = new MediCareAiClient('http://localhost:3000', () => accessToken);
const { summary } = await ai.generateSummary(clinicalText);
const ocr = await ai.cleanOcrImage(base64FromCamera, 'lab_report');
const { answer } = await ai.patientChat('When is my appointment?');
```

## Frontend Integration Points

| App | Endpoint | Use Case |
|-----|----------|----------|
| Secretary Dashboard | `POST /api/ai/summary`, `POST /api/ai/ocr-cleanup` | Document summaries, scan cleanup |
| Doctor Mobile App | `POST /api/ai/doctor-chat`, `POST /api/ai/report`, `POST /api/ai/appointment-note` | Visit docs, reports |
| Patient Mobile App | `POST /api/ai/patient-chat` | Health info assistant |
| Platform Admin | `GET /api/ai/metrics`, all endpoints | Monitoring |

## Tests

```bash
cd Integrations/AI/ai-service
npm install
npm test
```

## Postman

Import `Integrations/AI/MediCare-AI-API.postman_collection.json` or use the **AI (Ollama)** folder in `MediCare-Clinic-API.postman_collection.json` (regenerate with `node DevOps/Scripts/generate-postman-collection.mjs`).

Set `accessToken` after login via auth endpoints.
