# loki

Log aggregation backend. Private.

| Field | Value |
|---|---|
| Railway Service Name | `loki` |
| Dockerfile | `DevOps/Docker/loki/Dockerfile` (context `.`) |
| Command | `-config.file=/etc/loki/local-config.yaml` |
| Port | `3100` |
| Public / Private | **Private** |
| Persistent volume | **Required** (`/loki`) |
| Health Check | `GET /ready` → `200` |

## Used by
- grafana (logs datasource), otel-collector / promtail (log shipping).

## Note on promtail
`promtail` tails the Docker socket (`/var/run/docker.sock`) to ship container logs.
On Railway there is no Docker socket, so **promtail cannot run as-is**; rely on the
OTel logs pipeline (otel-collector → loki) instead. No file changes required.

## Smoke test
```bash
curl -f http://loki.railway.internal:3100/ready
```
Expected: `200` `ready`.
