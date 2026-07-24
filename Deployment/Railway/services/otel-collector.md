# otel-collector

OpenTelemetry Collector — receives OTLP traces/metrics/logs from services and fans out
to Jaeger / Prometheus / Loki. Private.

| Field | Value |
|---|---|
| Railway Service Name | `otel-collector` |
| Image / Dockerfile | Build `DevOps/Docker/otel/Dockerfile` (context `.`) — bakes Railway config |
| Command | `--config=/etc/otel-collector-config.yml` |
| Config file | `DevOps/Docker/otel/otel-collector-config.railway.yml` (jaeger.railway.internal) |
| Ports | `4317` (OTLP gRPC), `4318` (OTLP HTTP) |
| Public / Private | **Private** |

## Used by
All Nest services export to `http://otel-collector.railway.internal:4318`
(`OTEL_EXPORTER_OTLP_ENDPOINT`).

## Dependencies
- jaeger (traces), prometheus (metrics scrape/remote-write), loki (logs) — per its config.

## Notes
- Telemetry failures are non-fatal to services; deploy the collector early to avoid startup noise.
- The collector config references downstream hostnames — ensure they match the Railway service names.

## Smoke test
```bash
nc -z otel-collector.railway.internal 4318 && echo ok
```
Expected: `ok`; traces appear in Jaeger after service traffic.
