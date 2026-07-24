# openemr + mariadb-openemr

OpenEMR runtime required by `emr-service` readiness. Both services remain private.

## mariadb-openemr

| Field | Value |
|---|---|
| Railway Service Name | `mariadb-openemr` |
| Image | `mariadb:11.8` |
| Port | `3306` |
| Start Command | `mariadbd --character-set-server=utf8mb4` |
| Public / Private | **Private** |
| Persistent volume | **Required** at `/var/lib/mysql` |
| Health Check | `/usr/local/bin/healthcheck.sh --su-mysql --connect --innodb_initialized` |
| Environment template | `env/mariadb-openemr.env.example` |

## openemr

| Field | Value |
|---|---|
| Railway Service Name | `openemr` |
| Image | `openemr/openemr:latest` |
| Port | `80` (`443` is also exposed by the image) |
| Start Command | *(image default)* |
| Public / Private | **Private** |
| Persistent volumes | **Required** at `/var/log` and `/var/www/localhost/htdocs/openemr/sites` |
| Health Check | `GET https://localhost/meta/health/readyz` inside the container |
| Environment template | `env/openemr.env.example` |

## Deployment order

1. Deploy `mariadb-openemr` and wait for its health check.
2. Deploy `openemr` and wait for `/meta/health/readyz`.
3. Configure or obtain the OpenEMR OAuth client credentials.
4. Deploy `emr-service` with `OPENEMR_BASE_URL=http://openemr.railway.internal`.

## Expected health

```bash
curl -k -f https://openemr.railway.internal/meta/health/readyz
curl -f http://emr-service.railway.internal:3004/health/ready
```

Both commands must return `200`.
