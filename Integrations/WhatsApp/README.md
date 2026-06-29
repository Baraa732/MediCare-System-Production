# WhatsApp Integration

All WhatsApp / Evolution API integration lives in this folder.

## Layout

```
Integrations/WhatsApp/
├── client/
│   └── whatsapp.service.ts     HTTP client to Evolution API (used by auth-service)
├── evolution-api/
│   └── README.md               Docker service docs (third-party image)
├── Database/
│   └── MongoDB/                evolution DB (instance state)
└── README.md                   This file
```

## Docker services (in root `docker-compose.yml`)

| Container | Role | Host access |
|-----------|------|-------------|
| `mongodb` | Evolution API persistence | internal only |
| `evolution_api` | atendai/evolution-api:v1.8.7 | http://localhost:8080 |

## Connect WhatsApp (development)

1. `GET http://localhost:3000/api/auth/dev/whatsapp-status`
2. `GET http://localhost:3000/api/auth/dev/whatsapp-qr` — scan QR with WhatsApp
3. Register or `POST /api/auth/send-otp` when `connected: true`

## Show "MediCare" instead of phone number

Patients see the sender in WhatsApp chat list. To show **MediCare** (not only the raw number):

1. **`WHATSAPP_PROFILE_NAME=MediCare`** in `auth-service/.env` — auth-service calls Evolution API `POST /chat/updateProfileName/{instance}` on first send after connect.
2. **`CONFIG_SESSION_PHONE_CLIENT=MediCare`** in `docker-compose.yml` (Evolution API) — linked-device label.
3. OTP messages are prefixed with `*MediCare*` in the message body.

**Manual (one-time):** On the phone that scanned the QR, set WhatsApp profile name to **MediCare** (Settings → Profile).

**Production:** For a verified business name with green badge, use [WhatsApp Business API (Meta Cloud)](https://developers.facebook.com/docs/whatsapp) — different integration than Baileys/Evolution.

## Environment variables

Root `.env`:

```
MONGO_USER=
MONGO_PASSWORD=
EVOLUTION_API_KEY=
```

Auth-service `.env` (must match):

```
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=<same as root>
WHATSAPP_INSTANCE_NAME=clinic-management
WHATSAPP_PROFILE_NAME=MediCare
```

## Consumer

**auth-service** syncs `Integrations/WhatsApp/client/whatsapp.service.ts` at build via `npm run sync:whatsapp`.
