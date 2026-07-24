# prometheus

Metrics store & scraper. Private.

| Field | Value |
|---|---|
| Railway Service Name | `prometheus` |
| Dockerfile | `DevOps/Docker/prometheus/Dockerfile` (context `.`) |
| Config file | baked `prometheus.railway.yml` (targets use `*.railway.internal`) |
| Port | `9090` |
| Public / Private | **Private** |
| Persistent volume | Recommended (TSDB data) |
| Health Check | `GET /-/healthy` → `200` |

## Used by
- grafana (datasource), otel-collector (metrics pipeline).

## Notes
- Scrape targets in `prometheus.yml` use Docker service names; update targets to
  `*.railway.internal` addresses via config (config file only — no app code change).

## Smoke test
```bash
curl -f http://prometheus.railway.internal:9090/-/healthy
```
Expected: `200` `Prometheus Server is Healthy`.
