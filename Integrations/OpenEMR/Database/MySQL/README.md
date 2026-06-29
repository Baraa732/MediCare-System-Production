# MySQL (MariaDB)

OpenEMR clinical database.

| Compose service | Database | Used by |
|-----------------|----------|---------|
| `mariadb-openemr` | `openemr` | OpenEMR UI + emr-service (direct reads) |

Credentials: root `.env` → `OPENEMR_MYSQL_*`.

See also: `Integrations/OpenEMR/README.md`
