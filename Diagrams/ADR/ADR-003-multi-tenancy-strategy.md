# ADR-003: Multi-Tenancy Strategy

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

MediCare serves multiple independent clinics on shared infrastructure. Patients may visit multiple clinics (global identity). Staff belong to specific clinics via assignments. Platform operators (system managers) are tenant-agnostic. PHI must not leak across tenant boundaries.

## Decision

Adopt **shared database, shared schema, row-level isolation** via `tenant_id` column:

1. **Tenant root:** `clinic_db.tenants` — each clinic is a tenant (UUID)
2. **Staff scope:** `tenant_staff_assignments` junction table
3. **Patient scope:** Global `user_db.users` row; access scoped per clinic via `patient_clinic_relations` and appointments
4. **Resolution:** `TenantMiddleware` + `resolveTenantId()` priority chain
5. **Authorization:** `TenantAuthorizationGuard` calls `assertStaffAccess` / `assertPatientAccess`
6. **Query scoping:** `tenantFindWhere()` utility on all tenant-bound queries
7. **Gateway:** Strips client-supplied `x-tenant-id`; re-injects from validated JWT
8. **Patient exception:** Patients ignore JWT/header tenant claims; only `body.clinicId` trusted

Kafka events carry `tenantId` in signed envelopes. Consumers corroborate tenant claims via HTTP callback to source service.

## Consequences

### Positive
- Simple operations — one migration applies to all tenants
- Cost-efficient for 20–100 clinics
- Indexes on `(tenant_id, ...)` provide per-tenant query performance
- E2E cross-tenant tests pass (forged headers stripped, HMAC enforced)

### Negative
- Application-layer enforcement only — no Postgres RLS policies
- Shared OpenEMR instance — logical isolation via `patient_emr_links.tenant_id`
- `tenant-shared/` copied to each service — 9 copies to maintain
- Nullable `tenant_id` on some auth tables for global patients (by design)

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Missing tenant filter in new query | High | Code review; `tenantFindWhere` convention |
| Unknown role bypass in TenantAuthorizationGuard | Medium | P1: default-deny unknown roles |
| Shared OpenEMR cross-tenant | Medium | Per-tenant OAuth config; link scoping |
| SQL injection bypassing app layer | Low | TypeORM parameterized queries |

## Alternatives Considered

1. **Schema-per-tenant** — Rejected: migration × N clinics complexity.
2. **Database-per-tenant** — Rejected: 50+ Postgres instances impractical on Docker host.
3. **Postgres Row-Level Security** — Deferred: adds complexity; app-layer sufficient at current scale.
