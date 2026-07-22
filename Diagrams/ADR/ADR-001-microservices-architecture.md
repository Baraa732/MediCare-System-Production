# ADR-001: Microservices Architecture

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

MediCare is a multi-tenant clinic management SaaS handling authentication, user profiles, clinic administration, appointment booking, scheduling, notifications, reminders, EMR integration, and platform operations. The system must support independent scaling of write-heavy domains (appointments, notifications) while keeping PHI boundaries explicit.

The platform is deployed via Docker Compose on a single or small number of hosts — not Kubernetes. Services communicate over an internal bridge network (`clinic_network`).

## Decision

Adopt a **bounded-context microservices architecture** with nine NestJS services plus an API gateway:

| Service | Port | Primary responsibility |
|---------|------|------------------------|
| api-gateway | 3000 | JWT validation, routing, rate limiting, HMAC signing |
| auth-service | 3001 | Identity, sessions, OTP, MFA, JWT issuance |
| user-service | 3002 | User profiles, account linking, outbox publisher |
| system-manager-service | 3003 | Platform admin, activation codes, observability probes |
| emr-service | 3004 | OpenEMR patient sync and record access |
| clinic-service | 3006 | Tenant registry, staff assignments |
| appointment-service | 3007 | Appointment lifecycle, patient–clinic relations |
| scheduling-service | 3008 | Clinic hours, doctor availability, slot validation |
| notification-service | 3009 | Push, WhatsApp, staff inbox |
| reminder-service | 3010 | T-24h scheduled reminders |

**Synchronous HTTP** is used for request/response paths requiring immediate consistency (appointment booking validation chain). **Asynchronous Kafka** is used for fan-out side effects (notifications, reminders, EMR sync, audit).

## Consequences

### Positive
- Clear ownership boundaries; appointment contention isolated to `appointment_db`
- Independent deployability per service (Docker image per service)
- Failure isolation at process level — one service crash does not take down others
- Gateway centralizes auth and strips dangerous client headers

### Negative
- Appointment create requires 3+ synchronous internal HTTP hops (latency amplification)
- Distributed transactions absent — eventual consistency via Kafka
- Operational overhead: 9 services × health checks × migrations
- `tenant-shared/` modules copied per service — drift risk

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sync call chain failure on booking | Medium | Gateway circuit breakers; internal timeouts |
| Service sprawl without orchestration | Low | Docker Compose dependency ordering |
| Cross-service schema coupling | Medium | Kafka events + internal APIs only |

## Alternatives Considered

1. **Modular monolith** — Rejected: harder to isolate appointment/notification load; team already invested in service split.
2. **Kubernetes + service mesh** — Rejected: over-engineering for current scale target (≤100 clinics).
3. **Fewer services (merge scheduling + appointment)** — Rejected: scheduling is read-heavy; appointment is write-contended.
