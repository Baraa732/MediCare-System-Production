# ADR-007: Tenant Isolation Enforcement

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

Multi-tenant SaaS handling PHI requires defense-in-depth beyond database column scoping. Prior audits identified gaps where tenant context could be set without verifying actor membership. Remediation added authorization guards and cross-tenant security tests.

## Decision

Enforce tenant isolation through **seven layers**:

| Layer | Mechanism | Location |
|-------|-----------|----------|
| 1 | Strip client tenant headers | `api-gateway/src/main.ts` |
| 2 | JWT validation + tenant injection | Gateway → auth-service `validate-token` |
| 3 | Tenant resolution | `tenant-resolver.ts` |
| 4 | Tenant context (ALS) | `TenantContextService` |
| 5 | Tenant membership guard | `TenantGuard` |
| 6 | Actor authorization | `TenantAuthorizationGuard` + `TenantAccessChecker` |
| 7 | Query scoping | `tenantFindWhere()` on all reads/writes |

**Kafka isolation:**
- Signed envelopes with `tenantId`
- `topicRequiresTenantCorroboration` → HTTP verify-event callback
- `processed_kafka_messages` prevents replay

**Internal HTTP isolation:**
- HMAC + route allowlists
- Internal paths exempt from tenant guard but require service identity

**Patient-specific rule:** Patients cannot set tenant via header/JWT — only explicit `clinicId` in request body, then `assertPatientAccess` verifies `patient_clinic_relations`.

## Consequences

### Positive
- Cross-tenant security E2E tests pass (6 flows + 4 negative tests)
- Gateway prevents header injection attacks
- Kafka corroboration prevents forged appointment events
- Staff/patient access verified against clinic-service / appointment-service

### Negative
- `TenantAuthorizationGuard` returns `true` for unknown roles (line 74) — gap remains
- No Postgres RLS — DB admin can bypass app layer
- Internal service compromise bypasses JWT entirely (mitigated by HMAC + allowlists)

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| New endpoint missing guards | High | Convention: `@UseGuards(JwtAuthGuard, TenantGuard, TenantAuthorizationGuard)` |
| Unknown role bypass | Medium | P1: throw ForbiddenException for unrecognized roles |
| Corroboration HTTP failure | Low | Consumer rejects event; no side effect |

## Alternatives Considered

1. **Postgres RLS policies** — Deferred: requires SET app.tenant_id per connection.
2. **API gateway tenant routing only** — Rejected: insufficient; services must enforce independently.
3. **Per-tenant API keys** — Rejected: poor UX for staff dashboards.
