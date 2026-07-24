# Post-Deployment Tests

Run top-to-bottom after every service is deployed. Replace `<...domain>` with your
Railway public domains and use `*.railway.internal:<port>` for private checks.

Health endpoints for all Nest services:
- Liveness: `GET /health/live` → `200`
- Readiness: `GET /health/ready` → `200` (checks dependencies)

---

## 1. Infrastructure

| Service | Command | Expected |
|---|---|---|
| redis | `redis-cli -u redis://:PW@redis.railway.internal:6379 ping` | `PONG` |
| kafka-1 | `kafka-topics --bootstrap-server kafka-1.railway.internal:9092 --list` | topic list (from kafka-init) |
| postgres-* | `pg_isready -h postgres-<x>.railway.internal -U clinic_user` | `accepting connections` |
| jaeger | `curl -f http://jaeger.railway.internal:16686/` | `200` |
| prometheus | `curl -f http://prometheus.railway.internal:9090/-/healthy` | `200` |
| loki | `curl -f http://loki.railway.internal:3100/ready` | `200` |
| grafana | `curl -f https://<grafana-domain>/api/health` | `200` `database: ok` |
| otel-collector | `nc -z otel-collector.railway.internal 4318` | open |

---

## 2. Backend microservices

### auth-service (3001)
```bash
curl -f http://auth-service.railway.internal:3001/health/live
curl -f http://auth-service.railway.internal:3001/health/ready
```
Expected: `200`; ready reports `database`, `redis`, `kafka` = up.
- Integration: `POST /api/auth/login` via gateway returns a JWT for valid creds; `401` for bad creds.

### user-service (3002)
```bash
curl -f http://user-service.railway.internal:3002/health/ready
```
Expected: `200`, `database`+`kafka` up.
- Integration: authenticated `GET /api/users/me` via gateway returns the profile.

### clinic-service (3006)
```bash
curl -f http://clinic-service.railway.internal:3006/health/ready
```
Expected: `200`.
- Integration: `GET /api/clinics` via gateway returns a list (`200`).

### scheduling-service (3008)
```bash
curl -f http://scheduling-service.railway.internal:3008/health/ready
```
Expected: `200`.
- Integration: create availability, then read it back (`200`).

### appointment-service (3007)
```bash
curl -f http://appointment-service.railway.internal:3007/health/ready
```
Expected: `200`.
- Integration: book an appointment against an available slot → `201`; overlapping slot → `409`/validation error.

### notification-service (3009)
```bash
curl -f http://notification-service.railway.internal:3009/health/ready
```
Expected: `200`.
- Integration: emit a domain event (e.g. appointment created) and confirm a notification row is created and consumed from Kafka.

### reminder-service (3010)
```bash
curl -f http://reminder-service.railway.internal:3010/health/ready
```
Expected: `200`.
- Integration: schedule a reminder; confirm it calls notification-service at due time.

### system-manager-service (3003)
```bash
curl -f http://system-manager-service.railway.internal:3003/health/ready
```
Expected: `200`.
- Integration: `POST /v1/system-manager/dev/seed-default` (once) → default manager exists; login as that manager via the system dashboard returns a JWT.

### emr-service (3004) — optional
```bash
curl -f http://emr-service.railway.internal:3004/health/ready
curl -i https://<gateway-domain>/api/emr/health
```
Expected: `200`.

---

## 3. API Gateway (public)
```bash
curl -f https://<gateway-domain>/health/live
curl -f https://<gateway-domain>/health/ready
curl -i https://<gateway-domain>/api/auth/health
```
Expected: `200` on health; `/health/ready` shows all probed upstreams reachable; proxied `/api/*` route returns the upstream response (not `502`).

---

## 4. Dashboards (public)

### clinic-admin-dashboard
```bash
curl -f https://<admin-dashboard-domain>/health
curl -i https://<admin-dashboard-domain>/api/auth/health
```
Expected: `200`; `/api` proxy reaches the gateway.
- Integration: open the SPA, log in as a clinic admin, load the dashboard.

### system-manager-dashboard
```bash
curl -f https://<system-dashboard-domain>/
curl -i https://<system-dashboard-domain>/api/system-manager/health
```
Expected: `200`; `/api` proxy reaches the gateway.
- Integration: log in as the seeded system manager; verify the embedded Grafana panel loads (`VITE_GRAFANA_URL` + UID `medicare-platform`).

---

## 5. End-to-end sanity flow
1. Create a clinic (clinic-service).
2. Create a user/provider (user-service) and availability (scheduling-service).
3. Book an appointment (appointment-service).
4. Confirm a notification is generated (notification-service) and a reminder scheduled (reminder-service).
5. Confirm traces for the flow appear in Jaeger and logs in Grafana/Loki.

All steps should complete without `5xx`; cross-service calls resolve over `*.railway.internal`.
