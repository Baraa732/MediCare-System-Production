# ADR-008: Observability Architecture

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

A 9-service distributed system requires unified visibility into request latency, error rates, Kafka lag, and PHI access patterns. Production deployment must detect failures before clinics report them.

## Decision

Implement the **Grafana observability stack** in Docker Compose:

| Component | Role | Exposure |
|-----------|------|----------|
| OpenTelemetry Collector | Trace/metric ingestion | Internal :4317/:4318 |
| Jaeger | Distributed tracing UI | Internal :16686 |
| Prometheus | Metrics scraping | Internal :9090 |
| Grafana | Dashboards + alerting UI | Internal (prod); optional host port in dev |
| Loki | Log aggregation | Internal :3100 |
| Promtail | Docker log shipping | Reads docker.sock |

**Application instrumentation:**
- `@medicare/telemetry` shared library
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318` on all services
- Structured logging with `tenant_id`, `request_id`, `event` fields
- `/health/live`, `/health/ready`, `/metrics` on every service
- PHI audit via `phi_audit_logs` table + Kafka `audit.log` topic

**System Manager integration:**
- `platform-observability.service.ts` probes Prometheus, Grafana, Loki, Jaeger
- Docker socket read-only for container status
- Embedded Grafana dashboard in system-manager-dashboard

## Consequences

### Positive
- End-to-end tracing from gateway through internal HTTP chains
- PHI audit trail separate from application logs
- Platform health visible to system managers
- Production overlay disables anonymous Grafana access

### Negative
- All-in-one on single host — observability stack competes for RAM with app services
- Promtail docker.sock access is a security surface
- No alerting rules configured in Prometheus by default (dashboards only)
- Log retention in Loki unbounded without explicit limits

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| PHI in application logs | High | P1: log scrubbing policy; structured fields only |
| Observability stack SPOF | Low | System functions without Grafana; degrades debuggability |
| Disk growth (Loki + Prometheus TSDB) | Medium | P2: retention policies |
| Missing SLO alerting | Medium | P1: alert on gateway 5xx, Kafka lag, DB connections |

## Alternatives Considered

1. **Cloud-managed (Datadog, Honeycomb)** — Rejected: cost and vendor lock-in; Docker-first deployment.
2. **ELK stack** — Rejected: heavier resource footprint than Loki.
3. **Logs only, no tracing** — Rejected: insufficient for debugging 4-hop appointment chains.
