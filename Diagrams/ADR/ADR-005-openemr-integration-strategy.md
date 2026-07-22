# ADR-005: OpenEMR Integration Strategy

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

MediCare must integrate with a certified EHR for patient records, clinical documentation, and regulatory compliance. OpenEMR is deployed as a Docker container with MariaDB backend. Patient identity originates in MediCare `user-service`; clinical records live in OpenEMR.

## Decision

Integrate via a dedicated **emr-service** (port 3004) using:

1. **Deployment:** `openemr/openemr:latest` + `mariadb:11.8` in Docker Compose
2. **Sync trigger:** Kafka `user.created` event → `PatientSyncService.syncPatientFromUserCreated()`
3. **Mapping store:** `emr_db.patient_emr_links` — `(tenant_id, user_id) → openemr_patient_id`
4. **Tenant scoping:** Per-tenant `openemr_oauth_config`; links require non-null `tenant_id`
5. **Access control:** `emr-record.service.ts` enforces role-based access (doctor: assigned patients only; admin: clinic-wide)
6. **Throttling:** `TenantQueueThrottle` — 250ms min interval per tenant for EMR API calls
7. **Corroboration:** `UserKafkaCorroborator` verifies user exists before sync
8. **Internal API:** `GET /internal/emr/patient/:userId` for appointment-service lookups
9. **PHI audit:** Reads/writes emit `phi_audit_logs` via `PhiAuditPublisherService`

Appointments do **not** trigger EMR sync — only user registration does.

## Consequences

### Positive
- Async sync does not block user registration HTTP path
- Per-tenant link table enables multi-tenant logical isolation
- Throttle prevents OpenEMR API flooding
- FHIR/REST APIs enabled via OpenEMR settings

### Negative
- **Single shared OpenEMR instance** for all tenants — physical isolation absent
- OpenEMR is memory-heavy (1 GB limit) — scaling bottleneck
- Sync lag between user.created and EMR availability (seconds to minutes)
- OpenEMR MariaDB is additional operational surface

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OpenEMR container crash | High | Health check + restart; P1: EMR health dashboard |
| Cross-tenant patient in OpenEMR | Medium | tenant_id on links; corroboration |
| OpenEMR upgrade breaking API | Medium | Pin image tag in production |
| EMR sync DLT accumulation | Medium | Monitor user.created.dlt |

## Alternatives Considered

1. **OpenEMR per tenant** — Rejected: 50 containers impractical on current infra.
2. **Synchronous EMR create on registration** — Rejected: OpenEMR latency blocks auth flow.
3. **Third-party FHIR server (HAPI)** — Rejected: OpenEMR already integrated and deployed.
