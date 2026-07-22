# ADR-006: Internal HMAC Authentication

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

Microservices communicate over a flat Docker bridge network. Any compromised container could reach any internal port. A shared static token alone is insufficient — replay and caller impersonation must be prevented.

## Decision

Implement **HMAC-SHA256 request signing** for all service-to-service HTTP:

**Headers:**
- `x-service-name` — caller identity (must be in `INTERNAL_SERVICE_NAMES`)
- `x-service-timestamp` — epoch ms
- `x-service-signature` — HMAC of `METHOD\nPATH\nBODY\nTIMESTAMP`

**Implementation:**
- `internal-auth.crypto.ts` — sign/verify with 30-second freshness window
- `internal-http.signer.ts` — outbound header creation
- `InternalServiceGuard` — inbound verification on `/internal/*` routes
- `INTERNAL_ROUTE_ALLOWLISTS` — per-service, per-route caller allowlist (e.g., only `appointment-service` may call `validate-slot`)

**Gateway:** Signs all proxied upstream requests as `api-gateway`.

**Kafka:** Separate signed envelope verification via `kafka-event.verifier.ts` (not HMAC on HTTP, but analogous trust model).

## Consequences

### Positive
- Replay protection via timestamp window
- Caller identity bound to signature — cannot impersonate another service
- Route-level allowlists limit blast radius of compromised service
- E2E test confirms forged HMAC returns 401

### Negative
- Clock skew between containers can cause false rejections (30s window is tight)
- Body canonicalization must match exactly (JSON key ordering via `stableStringify`)
- Secret rotation requires coordinated rollout across all services
- Some legacy endpoints may still accept token-only auth during migration

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Secret in .env committed to repo | Critical | P0: secrets manager; rotate on deploy |
| Allowlist gaps (empty allowlist = deny) | Low | `findRouteAllowlist` returns undefined → deny |
| mTLS not implemented | Medium | Acceptable at current scale; HMAC sufficient |

## Alternatives Considered

1. **Shared static x-service-token only** — Rejected: no replay protection; E2E proved insufficient.
2. **mTLS / SPIFFE** — Deferred: operational complexity for Docker Compose deployment.
3. **JWT service tokens** — Rejected: HMAC per-request is simpler and stateless.
