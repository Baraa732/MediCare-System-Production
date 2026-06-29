# Phase 2 Go / No-Go — Safe References

**Date:** 2026-06-22  
**Scope:** Opaque session-scoped references, ref-only `BookingSession`, Zod tool schemas, orchestrated tool pipeline  
**Out of scope (unchanged):** Memory, multilingual, compliance, summarization

---

## Required Amendments — Status

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Opaque random refs `^(CLN\|DOC\|SLT\|APT)-[A-Z0-9]{4}$`, session-scoped, session TTL | **DONE** — `ReferenceResolverService` allocates random 4-char suffixes; Redis key `booking:refs:{patientId}:{sessionId}` with 3600s TTL |
| 2 | Remove `patientId` from `BookingSession`; identity from JWT + Redis namespace | **DONE** — Session payload is ref-only; `patientId` never persisted in session JSON |
| 3 | Skip dual-write UUID migration; feature flag + one-time migration + immediate ref-only | **DONE** — `BOOKING_USE_SAFE_REFS` (default on); `initSession` always creates fresh ref store; legacy sessions stripped on read |
| 4 | Reference lifecycle: `consumed` / `consumedAt`; slot consumed on book; appointment invalidated on cancel; clinic/doctor reusable | **DONE** — `markConsumed()` sets flags; orchestrator enforces on book/cancel/modify |

---

## Deliverables

### New components
- `src/ai/security/references/reference.types.ts`
- `src/ai/security/references/reference-resolver.service.ts`
- `src/ai/security/tools/tool-schemas.ts` (Zod strict)
- `src/ai/security/tools/tool-registry.service.ts`
- `src/ai/security/tools/booking-tool-orchestrator.service.ts`
- `src/ai/security/approved-tools.ts`

### Refactored
- `booking-session.service.ts` — ref-only session, ref store init/delete on rotation
- `booking-agent.service.ts` — routes all tool calls through orchestrator; updated system prompt for refs
- `ai.module.ts` — registers Phase 2 providers

### Tools (7)
`search_clinics`, `list_doctors`, `get_available_slots`, `get_upcoming_appointments`, `book_appointment`, `modify_appointment`, `cancel_appointment`

---

## Test Results

### Phase 1 regression (8 suites)
| Suite | Result |
|-------|--------|
| secure-logging | PASS |
| injection-detector | PASS |
| booking-exception-filter | PASS |
| redaction.service | PASS |
| booking-policy.service | PASS |
| booking-assistant.security | PASS |
| ai-rate-limit.service | PASS |
| tool-result-sanitizer.service | PASS |

### Phase 2 (3 suites)
| Suite | Tests | Result |
|-------|-------|--------|
| reference-resolver.service | 8 | PASS |
| tool-registry.service | 6 | PASS |
| booking-tool-orchestrator.service | 5 | PASS |

**Total: 11 suites, 43 tests — ALL PASS**  
**Build: PASS**

### Pre-existing failures (unchanged)
- `ai.service.spec.ts`, `ai.integration.spec.ts` — missing `PatientContextService` mock (not Phase 2 scope)

---

## Architecture (implemented)

```
LLM → BookingAgentService
        → BookingToolOrchestrator
            → ToolRegistry (normalize + Zod)
            → Policy (confirm steps, ownership, auth)
            → ReferenceResolverService (allocate / resolve / consume)
            → BookingToolsService (HTTP to clinic/scheduling/appointments)
            → ToolResultSanitizerService (LLM-safe summaries)
```

**Redis keys**
- `booking:session:{patientId}:{sessionId}` — ref-only workflow state
- `booking:refs:{patientId}:{sessionId}` — opaque ref → internal UUID map
- `booking:active-session:{patientId}` — current session id

---

## Residual Risks

1. **Docker smoke test not run in this session** — end-to-end booking with live Redis + gateway still recommended before production.
2. **Redis connection leak warning** — Jest reports open handles from `ioredis` in unit tests; no functional impact.
3. **LLM confirmation UX** — `confirm_book` / `confirm_cancel` / `confirm_modify` steps rely on LLM + lightweight affirmative detection; monitor for premature bookings.
4. **`BOOKING_USE_SAFE_REFS=false`** — legacy `BookingPolicyService` path retained for rollback tests only; agent currently always uses ref orchestrator.

---

## Verdict

### **CONDITIONAL GO**

Phase 2 implementation meets all four approved amendments. Unit/regression coverage is green (43/43). Recommend:

1. Run docker-compose smoke: login → `POST /v1/ai/patient-booking-session` → full book/cancel flow via patient test UI.
2. Verify LLM receives only `CLN-xxxx` / `DOC-xxxx` / `SLT-xxxx` / `APT-xxxx` in tool summaries (no UUID leakage).
3. Confirm slot replay blocked after successful booking in live Redis.

After smoke test passes → **FULL GO** for Phase 3 planning (memory/multilingual remain deferred).
