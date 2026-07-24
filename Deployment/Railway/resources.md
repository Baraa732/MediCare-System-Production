# Resource Estimates (CPU / RAM / Storage)

Baselines are taken from the `deploy.resources.limits` in `docker-compose.yml` where
present (many Nest services: `memory: 512m`, `cpus: 1.0`; grafana `512m`/`0.5`; Kafka
heap `-Xms256m -Xmx512m`). Values without a compose limit are conservative estimates —
tune against real Railway metrics.

> "Reserve" = steady-state target; "Limit" = burst ceiling. Storage applies only to
> services with a persistent volume.

## Application services

| Service | CPU (reserve → limit) | RAM (reserve → limit) | Storage |
|---|---|---|---|
| api-gateway | 0.25 → 1.0 | 256M → 512M | — |
| auth-service | 0.25 → 1.0 | 256M → 512M | — |
| user-service | 0.25 → 1.0 | 256M → 512M | — |
| clinic-service | 0.25 → 1.0 | 256M → 512M | — |
| scheduling-service | 0.25 → 1.0 | 256M → 512M | — |
| appointment-service | 0.25 → 1.0 | 256M → 512M | — |
| notification-service | 0.25 → 1.0 | 256M → 512M | — |
| reminder-service | 0.25 → 1.0 | 256M → 512M | — |
| system-manager-service | 0.25 → 1.0 | 256M → 512M | — |
| emr-service *(optional)* | 0.25 → 1.0 | 256M → 512M | — |
| ai-service *(optional)* | 0.25 → 1.0 | 512M → 1G (LLM I/O) | — |
| clinic-admin-dashboard | 0.1 → 0.25 | 64M → 128M | — |
| system-manager-dashboard | 0.1 → 0.25 | 64M → 128M | — |

## State services

| Service | CPU | RAM | Storage |
|---|---|---|---|
| postgres-* (each) | 0.25 → 1.0 | 256M → 512M | 5–10 GB (grows with data) |
| redis | 0.1 → 0.5 | 128M → 512M (`maxmemory 512mb`) | 1 GB (AOF enabled) |

There are **8 required** PostgreSQL instances (+2 optional for emr/ai). Budget storage
per DB independently.

## Messaging

| Service | CPU | RAM | Storage |
|---|---|---|---|
| zookeeper-1 | 0.1 → 0.5 | 128M → 256M | 1 GB |
| kafka-1 | 0.5 → 1.0 | 512M → 768M (heap 256–512M) | 5–10 GB (`retention 168h` / 1 GB/topic cap) |
| kafka-init | one-shot | 128M | — |

## Observability

| Service | CPU | RAM | Storage |
|---|---|---|---|
| otel-collector | 0.25 → 0.5 | 128M → 256M | — |
| jaeger (all-in-one) | 0.25 → 0.5 | 256M → 512M | in-memory (or add backend for persistence) |
| prometheus | 0.25 → 0.5 | 256M → 512M | 5–10 GB (TSDB) |
| loki | 0.25 → 0.5 | 256M → 512M | 5–10 GB (logs) |
| grafana | 0.25 → 0.5 | 256M → 512M (limit `512m`) | 1 GB |

## Totals (rough, required tier only — excludes emr/ai)

| Dimension | Steady reserve | Burst limit |
|---|---|---|
| CPU | ~4–5 vCPU | ~14–16 vCPU |
| RAM | ~4.5–5 GB | ~9–10 GB |
| Storage | ~55–90 GB | grows with usage |

Count: 11 app services (9 core + 2 dashboards) + 8 PostgreSQL + Redis + Zookeeper +
Kafka (+ kafka-init) + 5 observability = **~28 Railway services** for the required
platform; +4 for the optional emr/ai tier and their databases.

## Scaling guidance
- Scale **api-gateway** and the busiest domain services (appointment, notification) first under load.
- PostgreSQL storage and Kafka log volume are the fastest-growing dimensions — set alerts.
- Dashboards are static/nginx: cheap; scale horizontally for availability, not CPU.
- Jaeger all-in-one is memory-based; for production trace retention, attach a real storage backend.
