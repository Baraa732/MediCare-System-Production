# grafana

Dashboards & visualization. Public (recommended, for the system-manager dashboard embed).

| Field | Value |
|---|---|
| Railway Service Name | `grafana` |
| Dockerfile | `DevOps/Docker/grafana/Dockerfile` (context `.`) |
| Container port | `3000` (set `PORT`/target to `3000`) |
| Public / Private | **Public** (embedded by system-manager-dashboard) |
| Provisioning | baked `datasources.railway.yml` + dashboards |
| Persistent volume | Recommended (`/var/lib/grafana`) |
| Health Check | `GET /api/health` → `200` |
| Dashboard UID | `medicare-platform` |

## Required environment variables
| Var | Example / Value |
|---|---|
| `GF_AUTH_ANONYMOUS_ENABLED` | `true` |
| `GF_AUTH_ANONYMOUS_ORG_ROLE` | `Viewer` |
| `GF_SECURITY_ALLOW_EMBEDDING` | `"true"` |
| `GF_SERVER_ROOT_URL` | `https://<grafana-domain>` |

## Dependencies
- prometheus (metrics), loki (logs), jaeger (traces) as datasources.

## Notes
- Grafana listens on `3000` inside the container — the same number as api-gateway, but
  they are separate Railway services with separate domains, so there is no conflict.
- Set `GF_SERVER_ROOT_URL` and the dashboard's `VITE_GRAFANA_URL` to this service's public domain.

## Smoke test
```bash
curl -f https://<grafana-domain>/api/health
```
Expected: `200` JSON with `"database": "ok"`.
