# PostgreSQL (emr_db)

Link store for MediCare ↔ OpenEMR patient mapping.

| Compose service | Database | Used by |
|-----------------|----------|---------|
| `postgres-emr` | `emr_db` | emr-service |

Key tables: `patient_emr_links`, `openemr_oauth_config`.

Credentials: root `.env` → `POSTGRES_USER`, `POSTGRES_PASSWORD`.
