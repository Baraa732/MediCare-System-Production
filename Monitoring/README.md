# Monitoring

Optional observability configs (not wired in default `docker-compose.yml`).

| Tool | Config location |
|------|-----------------|
| Prometheus | `DevOps/Docker/prometheus/` |
| Grafana | `DevOps/Docker/grafana/` |
| Alertmanager | `DevOps/Docker/alertmanager/` |

To enable, add Prometheus/Grafana services to `docker-compose.yml` referencing these configs.

Health endpoints on all services: `/health`, `/health/live`, `/health/ready`.
