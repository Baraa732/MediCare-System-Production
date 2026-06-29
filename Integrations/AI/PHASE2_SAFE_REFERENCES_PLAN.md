# Phase 2 — Safe References & Schema-Validated Tools

**Status:** Analysis complete — **awaiting approval before implementation**  
**Scope:** Safe references, ToolRegistry, strict schemas, deterministic tool pipeline.  
**Out of scope:** Memory, summarization, multilingual, consent, retention, compliance.

---

## Executive Summary

Phase 1 secured sessions, JWT mutations, policy guards, and output redaction — but **UUIDs still exist server-side in `BookingSession` and in policy resolution**. The LLM can still *attempt* tool params like `clinicId` / `appointmentId`, and deterministic handlers bypass the tool pipeline entirely.

Phase 2 introduces a **reference indirection layer** so the LLM only ever sees and emits `CLN-01`-style tokens. All tool calls pass through a **ToolRegistry** with strict schemas before PolicyGuard and execution.

**Recommendation:** **GO to implement** after plan approval. Phase 1 gates remain prerequisites; no code changes until you approve this document.

---

## 1. Updated Architecture Diagram

### Current (Phase 1)

```mermaid
flowchart LR
  LLM --> Agent[BookingAgentService]
  Agent --> Policy[BookingPolicyService]
  Policy -->|"UUIDs from session"| Tools[BookingToolsService]
  Tools --> Downstream[Clinic / Scheduling / Appointment]
  Tools --> Agent
  Agent --> Sanitizer[ToolResultSanitizer]
  Sanitizer -->|"names only, no refs"| LLM
  Session[(booking:session:{patientId}:{sessionId})]
  Session -->|"stores clinicId, doctorId, slotId"| Policy
```

**Gaps:** Session stores UUIDs; policy resolves `clinicId`/`doctorId`/`appointmentId`; sanitizer uses numeric indices not refs; deterministic path skips registry.

### Target (Phase 2)

```mermaid
flowchart TB
  LLM --> Agent[BookingAgentService]
  Agent --> Orchestrator[BookingToolOrchestrator]

  Orchestrator --> Registry[ToolRegistry]
  Registry --> Schema[Zod Schema Validation]
  Schema --> Policy[PolicyGuard]
  Policy --> Resolver[ReferenceResolverService]
  Resolver --> Tools[BookingToolsService]
  Tools --> Downstream[Clinic / Scheduling / Appointment]
  Tools --> Orchestrator
  Orchestrator --> Sanitizer[ToolResultSanitizer]
  Sanitizer -->|"clinicRef, doctorRef only"| LLM

  Session[(booking:session:{patientId}:{sessionId})]
  Refs[(booking:refs:{patientId}:{sessionId})]
  Refs -->|"CLN-01 → UUID"| Resolver
  Session -->|"selected refs + confirm state"| Policy
```

**Invariant:** UUIDs exist only inside `ReferenceResolverService`, `BookingToolsService`, and HTTP clients — never in LLM prompts, tool summaries, or validated tool params.

---

## 2. Reference Schema Specification

### 2.1 Token format

| Type | Prefix | Pattern | Example |
|------|--------|---------|---------|
| Clinic | `CLN` | `^CLN-\d{2}$` | `CLN-01` |
| Doctor | `DOC` | `^DOC-\d{2}$` | `DOC-03` |
| Slot | `SLT` | `^SLT-\d{2}$` | `SLT-07` |
| Appointment | `APT` | `^APT-\d{2}$` | `APT-05` |

- Counters are **per session, per type**, zero-padded to 2 digits (`01`–`99`; extend to `001` if needed later).
- References are **opaque to the LLM** — no encoding of UUIDs in the token.

### 2.2 Redis entry shape

Stored at `booking:refs:{patientId}:{sessionId}` as a single JSON object:

```typescript
interface ReferenceStore {
  counters: { CLN: number; DOC: number; SLT: number; APT: number };
  entries: Record<string, ReferenceEntry>;
}

interface ReferenceEntry {
  type: 'clinic' | 'doctor' | 'slot' | 'appointment';
  id: string;                    // internal UUID — never exposed upstream of resolver
  createdAt: string;             // ISO timestamp
  parentRef?: string;            // e.g. DOC-03 → clinicRef CLN-01
  meta?: {
    name?: string;
    city?: string;
    scheduledAt?: string;
    startTime?: string;
  };
}
```

### 2.3 Rejection rules

| Input | Action |
|-------|--------|
| Unknown ref (`CLN-99` not in store) | Reject — `unknown_reference` |
| Expired ref (Redis key TTL expired) | Reject — `expired_reference` |
| Ref from different `sessionId` | Reject — `reference_session_mismatch` |
| Ref from different `patientId` | Reject — `reference_patient_mismatch` |
| Raw UUID in any tool param | Reject — `uuid_not_allowed` |
| Malformed token (`CLN-1`, `clinic-01`) | Reject — `malformed_reference` |
| Extra fields in tool params | Reject — `schema_violation` |

### 2.4 Session state (refs only, no UUIDs)

```typescript
interface BookingSession {
  patientId?: string;
  step?: 'start' | 'pick_doctor' | 'pick_slot' | 'confirm_book' | 'confirm_modify' | 'confirm_cancel' | 'completed';
  selectedClinicRef?: string;
  selectedDoctorRef?: string;
  pendingSlotRef?: string;
  pendingAppointmentRef?: string;
  date?: string;                 // YYYY-MM-DD — not a secret identifier
  clinicName?: string;           // display context for LLM (no IDs)
  doctorName?: string;
  slotTime?: string;
}
```

Remove from session: `clinicId`, `doctorId`, `slotId`, `appointmentId`, `candidates[].id`, `doctorCandidates[].id`.

---

## 3. Redis Key Design

| Key | TTL | Contents |
|-----|-----|----------|
| `booking:active-session:{patientId}` | 3600s | Current `sessionId` (unchanged) |
| `booking:session:{patientId}:{sessionId}` | 3600s | `BookingSession` (refs + confirm state only) |
| `booking:refs:{patientId}:{sessionId}` | **3600s** | `ReferenceStore` (new) |

**Lifecycle:**

1. `POST /patient-booking-session` → create empty `ReferenceStore` + session.
2. On session rotation → delete old `booking:refs:{patientId}:{oldSessionId}` with old session key.
3. On ref allocation → `SETEX` both session and refs keys (refresh TTL together).
4. Legacy `booking:session:{sessionId}` migration unchanged; refs store starts empty on migrate.

---

## 4. Tool Registry & Schemas

### 4.1 Technology choice: **Zod**

| Criterion | Zod | class-validator |
|-----------|-----|-----------------|
| Strict reject unknown keys | `.strict()` native | `forbidUnknownValues` (weaker on plain objects) |
| Refine UUID rejection | `.refine()` | Custom validators |
| Parse LLM JSON directly | `schema.safeParse(obj)` | Needs `plainToInstance` |
| Nest HTTP DTOs | N/A | Keep for controllers |

**Action:** Add `zod` dependency for tool schemas only.

### 4.2 Approved tools (Phase 2)

| Tool | LLM params | Returns (sanitized) | Auth / gates |
|------|------------|---------------------|--------------|
| `search_clinics` | `{ query: string }` | `{ clinicRef, name, city }[]` | None |
| `list_doctors` | `{ clinicRef: string }` | `{ doctorRef, name, specialization }[]` | Valid `clinicRef` |
| `get_available_slots` | `{ clinicRef, doctorRef, date }` | `{ slotRef, startTime }[]` | Valid refs |
| `get_upcoming_appointments` | `{}` | `{ appointmentRef, clinicName, doctorName, scheduledAt, status }[]` | Patient JWT context |
| `book_appointment` | `{ slotRef: string }` | success message | `step === confirm_book`, valid `slotRef`, patient JWT |
| `modify_appointment` | `{ appointmentRef, slotRef }` | success message | `step === confirm_modify`, ownership, patient JWT |
| `cancel_appointment` | `{ appointmentRef, reason? }` | success message | `step === confirm_cancel`, ownership, patient JWT |

Rename in prompts: `list_doctors` accepts `clinicRef` (alias `search_doctors` → `list_doctors` in registry).

### 4.3 Shared Zod helpers

```typescript
const REF_PATTERNS = {
  clinic: /^CLN-\d{2}$/,
  doctor: /^DOC-\d{2}$/,
  slot:   /^SLT-\d{2}$/,
  apt:    /^APT-\d{2}$/,
};

const noUuid = z.string().refine((v) => !UUID_RE.test(v), 'uuid_not_allowed');

const clinicRefSchema = noUuid.refine((v) => REF_PATTERNS.clinic.test(v), 'malformed_reference');
// ... etc.
```

Each tool schema uses `.strict()` — extra fields fail validation.

### 4.4 ToolRegistry structure

```typescript
interface ToolDefinition {
  name: ApprovedBookingTool;
  schema: z.ZodType;
  auth: 'none' | 'patient_jwt';
  requiresConfirmStep?: BookingSession['step'];
  resolveRefs?: (params: unknown, ctx: ToolContext) => Promise<ResolvedParams>;
  handler: (resolved: ResolvedParams, ctx: ToolContext) => Promise<ToolResult>;
}

@Injectable()
class ToolRegistry {
  register(def: ToolDefinition): void;
  get(name: string): ToolDefinition | undefined;
  validate(name: string, params: unknown): ValidationResult;
  listApproved(): string[];
}
```

---

## 5. Tool Execution Flow (detailed)

```
1. LLM emits { tool, params }
2. ToolRegistry.get(tool) — reject unknown tool
3. schema.safeParse(params) — reject malformed / UUID / extra fields
4. PolicyGuard.validateToolCall() — confirm step, ownership, injection (unchanged tier)
5. ReferenceResolver.resolveRefs(tool, parsedParams, patientId, sessionId)
      → maps clinicRef/doctorRef/slotRef/appointmentRef → internal UUIDs
6. BookingToolsService.execute(resolvedInternalParams) — existing HTTP clients
7. On success: ReferenceResolver.allocate() for new entities (search results, slots, appointments)
8. ToolResultSanitizer — emit only refs + display fields to conversationHistory
9. Update BookingSession (refs + step only)
```

**Deterministic handlers** (`tryHandleDeterministicQueries`) must either:

- **Option A (recommended):** Route through `BookingToolOrchestrator` with synthetic tool calls, or
- **Option B:** Duplicate ref allocation + sanitizer output (higher drift risk).

### 5.1 Confirmation workflow

| Mutation | Required `session.step` | Transition |
|----------|-------------------------|------------|
| `book_appointment` | `confirm_book` | User confirms slot → set `pendingSlotRef` + `confirm_book` |
| `modify_appointment` | `confirm_modify` | User picks new slot → set refs + `confirm_modify` |
| `cancel_appointment` | `confirm_cancel` | User confirms cancel target → set `pendingAppointmentRef` + `confirm_cancel` |

Orchestrator sets confirm step from **server-side selection** (resolved refs), not from LLM-declared intent alone.

### 5.2 Updated system prompt (sketch)

```
Tools use references only: clinicRef (CLN-##), doctorRef (DOC-##), slotRef (SLT-##), appointmentRef (APT-##).
Never use or request database IDs or UUIDs.

list_doctors({ "clinicRef": "CLN-01" })
book_appointment({ "slotRef": "SLT-07" })
cancel_appointment({ "appointmentRef": "APT-05", "reason": "..." })
```

---

## 6. File-by-File Implementation Plan

### New files

| File | Purpose |
|------|---------|
| `security/references/reference.types.ts` | `ReferenceStore`, `ReferenceEntry`, token patterns |
| `security/references/reference-resolver.service.ts` | Allocate, resolve, validate, Redis CRUD |
| `security/tools/tool-registry.service.ts` | Central registry |
| `security/tools/tool-schemas.ts` | Zod schemas per tool |
| `security/tools/booking-tool-orchestrator.service.ts` | Full pipeline (steps 2–9) |
| `security/tools/resolved-params.types.ts` | Internal-only resolved UUID bag |
| `test/reference-resolver.service.spec.ts` | Ref isolation tests |
| `test/tool-registry.spec.ts` | Schema rejection tests |
| `test/booking-tool-orchestrator.spec.ts` | End-to-end pipeline tests |

### Modified files

| File | Changes |
|------|---------|
| `package.json` | Add `zod` |
| `booking-tool.types.ts` | Add `modify_appointment`; ref-based param types |
| `booking-policy.service.ts` | Delegate schema to registry; policy on **resolved** params; ref-only param keys |
| `booking-agent.service.ts` | Replace inline tool loop with orchestrator; update SYSTEM_PROMPT; strip UUID session updates |
| `booking-session.service.ts` | Init/delete refs key on rotation; refresh refs TTL on save |
| `booking-session.service.ts` (`BookingSession`) | Remove UUID fields; add ref fields + confirm steps |
| `booking-tools.service.ts` | Accept only resolved internal params (unchanged signatures internally) |
| `tool-result-sanitizer.service.ts` | Emit `clinicRef`/`doctorRef`/etc.; never numeric-only indices |
| `ai.module.ts` | Register new providers |
| `booking-agent.service.ts` (`tryHandleDeterministic*`) | Allocate refs for search/list output |
| `test/booking-policy.service.spec.ts` | Update for ref-based flows |
| `test/booking-assistant.security.spec.ts` | Add UUID-in-param rejection cases |

### Unchanged (Phase 1 retained)

- `InjectionDetectorService`, `RedactionService`, `AiExceptionFilter`
- JWT mutations + `x-patient-id` ownership verify
- Server-managed session init endpoint

---

## 7. Migration Strategy

### Phase 2a — Dual stack (1 release)

- Deploy `ReferenceResolverService` + `ToolRegistry`.
- Tool results emit **both** refs and legacy numbered lists (refs primary in prompt).
- Policy accepts refs; **reject** `clinicId`/`doctorId`/`slotId`/`appointmentId` in LLM params.
- Session still dual-writes UUIDs internally (temporary).

### Phase 2b — Ref-only (next release)

- Remove UUID fields from `BookingSession`.
- Remove `resolveClinicId` / `resolveDoctorId` from policy (resolver only).
- Sanitizer ref-only output.

### Phase 2c — Orchestrator cutover

- Deterministic handlers routed through orchestrator.
- Delete dead code in `booking-agent.executeTool` switch.

### Rollback

- Feature flag `BOOKING_USE_SAFE_REFS=true` (env). When false, fall back to Phase 1 session-UUID policy (document only; implement if ops requires).

### Deployment order

1. ai-service (self-contained; no appointment-service changes).
2. Rebuild patient test UI (no client changes required — server session unchanged).

---

## 8. Test Plan

### Unit — ReferenceResolverService

| ID | Case | Expected |
|----|------|----------|
| R1 | Allocate `CLN-01`, `CLN-02` | Sequential counters |
| R2 | Resolve valid ref | Returns UUID |
| R3 | UUID supplied as `clinicRef` | `uuid_not_allowed` |
| R4 | Malformed `CLN-1` | `malformed_reference` |
| R5 | Unknown `CLN-99` | `unknown_reference` |
| R6 | Expired Redis key | `expired_reference` |
| R7 | Cross-session reuse | `reference_session_mismatch` |
| R8 | Cross-patient reuse | `reference_patient_mismatch` |

### Unit — ToolRegistry / Zod schemas

| ID | Case | Expected |
|----|------|----------|
| S1 | Extra field `{ clinicRef, foo: 1 }` | `schema_violation` |
| S2 | `book_appointment({ slotRef: "<uuid>" })` | `uuid_not_allowed` |
| S3 | Missing required `clinicRef` on `list_doctors` | `schema_violation` |
| S4 | Valid minimal params | Pass |

### Integration — BookingToolOrchestrator

| ID | Case | Expected |
|----|------|----------|
| O1 | Full search → list → slots → confirm → book | Refs only in LLM history |
| O2 | `book_appointment` without `confirm_book` | Denied |
| O3 | `cancel_appointment` with victim `appointmentRef` | Denied (ownership) |
| O4 | Conversation history grep UUID regex | No matches |

### Regression — Phase 1 security suite

All 24 existing security tests must remain green.

---

## 9. Gap Analysis (Phase 1 → Phase 2)

| Area | Phase 1 state | Phase 2 fix |
|------|---------------|-------------|
| LLM tool params | Policy may accept `clinicId` from allowlist | Ref-only params via Zod |
| Session storage | `candidates[].id` UUIDs | Refs in Redis store |
| Sanitizer output | `1. Dr. Name` indices | `DOC-03: Dr. Name` |
| `cancel_appointment` | `appointmentId` in params | `appointmentRef` only |
| `book_appointment` | Ignores LLM params; uses session UUIDs | Requires `slotRef` param |
| `modify_appointment` | Not implemented | New tool |
| Deterministic search | Bypasses registry; stores UUIDs in session | Route through orchestrator |
| Tool validation | Ad-hoc switch in PolicyGuard | Central Zod + ToolRegistry |

---

## 10. Go / No-Go Recommendation

### Prerequisites (must be true)

- [x] Phase 1 remediation deployed (JWT mutations, session init, tiered injection, exception redaction)
- [x] Phase 1 security tests passing (24/24)
- [ ] Manual docker smoke test completed (recommended before Phase 2 merge)

### Phase 2 plan

| Criterion | Assessment |
|-----------|------------|
| Solves UUID-in-LLM-context | **Yes** — refs indirection + strict schemas |
| Compatible with Phase 1 security | **Yes** — PolicyGuard and JWT path preserved |
| Scope creep | **Controlled** — no memory/compliance |
| Complexity | **Medium** — new Redis store + orchestrator refactor |
| Risk | **Medium** — deterministic path migration needs care |

### Recommendation

**GO for implementation after you approve this plan.**

**NO-GO for coding until approval** — no files have been modified for Phase 2.

---

## Approval Checklist

Reply to approve or request changes:

- [ ] Reference format (`CLN-01` / 2-digit counters)
- [ ] Zod for tool schemas (vs class-validator only)
- [ ] Add `modify_appointment` tool
- [ ] Dual-stack migration (2a → 2b) vs big-bang cutover
- [ ] Route deterministic handlers through orchestrator (Option A)
- [ ] **Proceed with Phase 2 implementation**

---

## Related Documents

- [`PHASE1_SECURITY.md`](PHASE1_SECURITY.md) — Phase 1 baseline
- [`PHASE1_REMEDIATION_PLAN.md`](PHASE1_REMEDIATION_PLAN.md) — Phase 1 fixes
- [`PHASE1_GO_NO_GO.md`](PHASE1_GO_NO_GO.md) — Phase 1 sign-off
- [`PHASE2_GO_NO_GO.md`](PHASE2_GO_NO_GO.md) — Phase 2 sign-off

---

## Approved Amendments (2026-06-22)

Implementation incorporated four required changes:

1. **Opaque random references** — `^(CLN|DOC|SLT|APT)-[A-Z0-9]{4}$` (e.g. `CLN-A7K2`), not sequential counters. Session-scoped in `booking:refs:{patientId}:{sessionId}` with session TTL.
2. **No `patientId` in `BookingSession`** — patient identity derived only from JWT context and Redis key namespace.
3. **No dual-write UUID migration** — `BOOKING_USE_SAFE_REFS` feature flag (default on), one-time legacy strip on read, immediate ref-only sessions.
4. **Reference lifecycle** — `ReferenceEntry.consumed` / `consumedAt`; slot consumed after book; appointment invalidated after cancel; clinic/doctor refs reusable until session expiry.

## Implementation Status

**COMPLETE** — see [`PHASE2_GO_NO_GO.md`](PHASE2_GO_NO_GO.md) for test results and conditional GO verdict.
