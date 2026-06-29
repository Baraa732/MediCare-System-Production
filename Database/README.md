# Database

Compose-managed data stores. Integration-specific databases live under `Integrations/`.

| Folder | Stores |
|--------|--------|
| `PostgreSQL/` | auth_db, user_db, system_db |
| `Redis/` | Sessions, rate limits, JWT cache |
| `Integrations/OpenEMR/Database/` | emr_db (PostgreSQL), openemr (MySQL) |
| `Integrations/WhatsApp/Database/` | evolution (MongoDB) |

All instances are defined in root `docker-compose.yml`.
