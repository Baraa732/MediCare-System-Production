# jaeger

Distributed tracing backend (all-in-one). Private (UI can be made Public if desired).

| Field | Value |
|---|---|
| Railway Service Name | `jaeger` |
| Image | `jaegertracing/all-in-one:1.57` |
| Ports | `16686` (UI), `4317`/`4318` (OTLP in) |
| Public / Private | **Private** (expose `16686` publicly only if you want the UI online) |
| Health Check | UI reachable on `16686` |

## Required environment variables
| Var | Value |
|---|---|
| `COLLECTOR_OTLP_ENABLED` | `"true"` |

## Used by
- otel-collector exports traces here.

## Smoke test
```bash
curl -f http://jaeger.railway.internal:16686/
```
Expected: `200` (Jaeger UI).
