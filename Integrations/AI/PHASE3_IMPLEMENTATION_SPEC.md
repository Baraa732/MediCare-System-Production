# Phase 3 — Memory, Summarization & Encrypted Persistence

**Status:** Approved — implementation authorized  
**Prerequisites:** Phase 1 security ✅ · Phase 2 safe references ✅  
**Detailed design:** [`PHASE3_ARCHITECTURE.md`](PHASE3_ARCHITECTURE.md) (schema, encryption, threat model, migrations)

---

## Goal

Add long-term conversational memory to the patient booking assistant while preventing PHI leakage, memory poisoning, and cross-session persistence of booking identifiers.

---

## Core Principle

Use three isolated storage layers:

### Layer 1 — Session State (Redis, TTL 1 hour)

**Purpose:** active booking workflows only.

| Allowed | Forbidden |
|---------|-----------|
| booking state | long-term memory |
| opaque refs (`CLN-*`, `DOC-*`, `SLT-*`, `APT-*`) | conversation history |
| temporary workflow progress | summaries |

**Keys (existing):** `booking:session:{patientId}:{sessionId}`, `booking:refs:{patientId}:{sessionId}`, `booking:active-session:{patientId}`

### Layer 2 — Conversation History (Postgres, encrypted)

**Purpose:** store redacted conversation turns and rolling summaries.

| Allowed | Forbidden |
|---------|-----------|
| encrypted user messages | appointment IDs |
| encrypted assistant messages | tool payloads |
| encrypted summaries | internal UUIDs |
| | JWTs |
| | booking refs |

**Tables:** `ai_conversation_threads`, `ai_conversation_messages`, `ai_conversation_summaries`

### Layer 3 — Structured Memory (Postgres)

**Purpose:** persist approved user preferences.

| Allowed examples | Forbidden |
|------------------|-----------|
| preferred language | free-text clinical notes |
| preferred region | appointment history |
| communication preferences | identifiers |
| accessibility preferences | tool outputs |
| booking habits | |
| `clinical_memory` (enum values only) | |

**Tables:** `ai_patient_memory`, `ai_memory_pending_approvals`, `ai_patient_consents`, `ai_memory_audit_log`

---

## Non-Negotiable Rules

1. Booking data never persists beyond Redis.
2. The memory system must **never** access Redis booking refs.
3. Tool outputs and tool parameters are never stored.
4. Memory writes are server-side only.
5. The LLM cannot directly save memory.
6. Raw message history is never sent back to the LLM.
7. Only structured memory and sanitized summaries may be used as context.

---

## Memory Extraction

Server-side extraction pipeline (`MemoryExtractionService`):

1. Redact identifiers (`RedactionService`)
2. Detect prompt injection (`InjectionDetectorService`)
3. Validate against allowlist schema (Zod per `memory_key`)
4. Check consent (`ConsentService`)
5. Require approval when needed → `ai_memory_pending_approvals`
6. Store only approved facts → `ai_patient_memory` (versioned insert)

**Extraction priority:**

| Priority | Method |
|----------|--------|
| 1 | Explicit user instructions (regex / intent) |
| 2 | Rule-based patterns |
| 3 | Optional LLM classification (output must pass schema validation) |

LLM classifier output is **never** written without Zod validation and approval gates.

---

## Allowed Memory Keys

| Key | Default expiry |
|-----|----------------|
| `preferred_language` | No expiry |
| `preferred_region` | 12 months |
| `communication_preference` | 12 months |
| `accessibility_preference` | Until erasure |
| `booking_habits` | 6 months |
| `clinical_memory` | Consent-scoped (12 months default) |

**Reject any key containing:** `id`, `ref`, `token`, `appointment`, `uuid`, `jwt`, `tool`

---

## Clinical Memory Constraints

Clinical memory uses **predefined enums only** — no free-text medical notes.

```json
{
  "category": "communication_need",
  "value": "requires_interpreter"
}
```

Adding new categories requires a schema migration and clinical review. See [`PHASE3_ARCHITECTURE.md` §3.9](PHASE3_ARCHITECTURE.md).

---

## Summarization Rules

Summaries must:

- exclude identifiers (UUID, JWT, refs, phone, email)
- exclude exact appointment details
- exclude tool output
- paraphrase rather than quote (no verbatim > 20 words)
- be regenerable from source messages (`input_seq_from` / `input_seq_to`)
- include provenance metadata (`summary_prompt_version`, `model_id`, `source`)

If summarization fails post-validation, **discard the summary** — do not store a failed artifact.

Prompt templates live in code only; never persisted.

---

## Encryption Requirements

Envelope encryption per [`PHASE3_ARCHITECTURE.md` §4](PHASE3_ARCHITECTURE.md):

| Component | Specification |
|-----------|---------------|
| DEK | Random 256-bit key per `ai_conversation_threads` row |
| KEK | AWS KMS or HashiCorp Vault (production) |
| Message encryption | AES-256-GCM |
| AAD | `{thread_id}:{seq}:{key_version}` — **no `patient_id`** |
| Integrity | `content_mac` = HMAC-SHA256(plaintext, `MEMORY_INTEGRITY_KEY`) |
| Dev fallback | Env-based `MEMORY_KEK` acceptable in non-production only |

Production **must** use KMS or Vault before enabling `MEMORY_CONVERSATION_STORAGE=true`.

---

## Consent Model

Progressive opt-in:

| Step | Scope | Trigger |
|------|-------|---------|
| 1 | `conversation_storage` | First booking assistant use |
| 2 | `preference_memory` + `summarization` | After 2–3 turns, non-blocking prompt |
| 3 | `clinical_memory` | Explicit checkbox only |

Revoking consent must **immediately** stop new writes. Reads return empty; booking continues without memory.

---

## Retention Defaults

All values **configurable via env** until legal sign-off.

| Data | Default | Config key |
|------|---------|------------|
| Session state (L1) | 1 hour | Redis TTL |
| Conversation history (L2) | 18 months | `MEMORY_RETENTION_MESSAGES_MONTHS` |
| `booking_habits` | 6 months | per-key default |
| `preferred_region`, `communication_preference` | 12 months | per-key default |
| `preferred_language` | No expiry | — |
| `clinical_memory` | Consent-scoped | — |
| Pending approvals | 30 days | `MEMORY_PENDING_APPROVAL_DAYS` |
| Superseded memory rows | 90 days | `MEMORY_RETENTION_SUPERSEDED_DAYS` |

---

## Right to Erasure

`POST /v1/ai/patient-memory/erasure` (patient JWT)

Patients must be able to:

- delete conversation history (L2 ciphertext + summaries + thread DEK)
- delete structured memory (active + superseded rows)
- revoke all consents
- clear pending approvals

**SLA:** 72 hours · API returns `202 Accepted` immediately.

---

## Security Controls

| Control | Implementation |
|---------|----------------|
| Schema allowlists | Zod per `memory_key` + forbidden key substring check |
| Prompt injection detection | `InjectionDetectorService` on user input + extraction candidates |
| Rate limits | Max 3 auto memory writes/patient/hour |
| Conflict detection | Route to `ai_memory_pending_approvals`, never silent overwrite |
| Audit logging | `ai_memory_audit_log` — no PHI in metadata |
| Encryption key rotation | KEK rewrap + `key_version`; integrity key re-MAC job |
| Access controls | All queries scoped `patient_id = jwt.sub`; no decrypt API for patients |

---

## Implementation Order

### Phase 3a — Encryption foundation

- `encryption.service.ts`, `integrity.service.ts`, `kms-adapter.service.ts`
- Migration `1730000000001`: threads (`wrapped_dek`) + messages (`content_mac`)
- Tests: encrypt/decrypt round-trip, AAD swap rejection, HMAC tamper detection

### Phase 3b — Conversation + consent + audit

- `conversation.service.ts`, `consent.service.ts`, `memory-audit.service.ts`
- Migration `1730000000002`: summaries, consents, audit log
- Feature flags: `MEMORY_ENABLED`, `MEMORY_CONVERSATION_STORAGE` (staging only)

### Phase 3c — Summarization

- `summarization.service.ts`, `language-detection.service.ts`
- Provenance fields on summary rows
- Post-summary identifier validation + discard-on-fail

### Phase 3d — Memory extraction + approvals

- `memory-extraction.service.ts`, `memory-poisoning.guard.ts`, `pending-approval.service.ts`
- Migration `1730000000003`: versioned `ai_patient_memory`, `ai_memory_pending_approvals`
- Feature flag: `MEMORY_EXTRACTION`

### Phase 3e — Agent integration + consent UI

- `patient-memory.facade.ts` wired into `booking-agent.service.ts`
- `patient-memory.controller.ts` + DTOs
- Progressive consent in `Frontend/patient-ai-test/index.html`
- Feature flags: `MEMORY_SUMMARIZATION`

### Phase 3f — Erasure + rotation jobs

- `erasure.service.ts`
- Cron: `expire_stale_memory`, `expire_pending_approvals`, `rewrap_thread_deks`
- `PHASE3_GO_NO_GO.md`

---

## Production Gates

Do **not** enable persistent memory in production until:

- [ ] KMS/Vault configured (`MEMORY_KMS_KEY_ID`) and health check green
- [ ] Retention settings approved by legal/compliance
- [ ] LLM data-processing agreements verified (DeepSeek/Ollama)

**NO-GO for production** if durable storage requires:

- appointment identifiers
- booking refs
- tool outputs
- free-text clinical notes

---

## Feature Flags

| Flag | Default | Enables |
|------|---------|---------|
| `MEMORY_ENABLED` | `false` | Master switch |
| `MEMORY_CONVERSATION_STORAGE` | `false` | L2 writes |
| `MEMORY_EXTRACTION` | `false` | L3 extraction |
| `MEMORY_SUMMARIZATION` | `false` | Async summaries |

Rollout: dev → staging (all flags on) → production (gates above).

---

## Related Documents

- [`PHASE3_ARCHITECTURE.md`](PHASE3_ARCHITECTURE.md) — full schema, encryption design, threat model, file-by-file plan
- [`PHASE2_GO_NO_GO.md`](PHASE2_GO_NO_GO.md)
- [`PHASE1_SECURITY.md`](PHASE1_SECURITY.md)
