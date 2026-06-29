# LangGraph Migration Guide

## Scope

This migration replaces booking-assistant orchestration with LangGraph and removes Ollama runtime paths.

### In Scope
- LangGraph workflow for booking orchestration.
- LLM provider abstraction (`LlmProvider`) with Gemini implementation.
- Feature flags:
  - `AI_PROVIDER=gemini`
  - `LANGGRAPH_ENABLED=true`
  - `OLLAMA_ENABLED=false`
- Security invariants preserved:
  - no UUIDs in prompts
  - no UUIDs in replies
  - no tool payload persistence to prompts
  - no refs/UUIDs in long-term memory

### Out of Scope
- Model training / fine-tuning
- RAG / vector DB
- direct SQL or repository access from agent orchestration

## File-Level Changes

### Added
- `Integrations/AI/ai-service/src/ai/services/booking-langgraph.workflow.ts`
- `Integrations/AI/ai-service/src/ai/providers/llm-provider.ts`
- `Integrations/AI/ai-service/src/ai/providers/gemini-llm.provider.ts`
- `Integrations/AI/ai-service/src/ai/providers/llm-provider.registry.ts`
- `Integrations/AI/ai-service/src/ai/memory/patient-memory.facade.ts`
- `Integrations/AI/ai-service/test/booking-langgraph.integration.spec.ts`
- `Integrations/AI/LANGGRAPH_BOOKING_ARCHITECTURE.md`

### Removed
- `Integrations/AI/ai-service/src/ai/services/ollama.service.ts`
- `Integrations/AI/ai-service/test/ollama.service.spec.ts`
- `Integrations/AI/scripts/ollama-init.sh`
- `docker-compose.yml` Ollama services/volumes/dependencies

### Updated
- `Integrations/AI/ai-service/src/ai/services/booking-agent.service.ts`
- `Integrations/AI/ai-service/src/ai/services/ai.service.ts`
- `Integrations/AI/ai-service/src/ai/memory/summarization.service.ts`
- `Integrations/AI/ai-service/src/ai/guards/ai-enabled.guard.ts`
- `Integrations/AI/ai-service/src/ai/controllers/ai.controller.ts`
- `Integrations/AI/ai-service/src/ai/controllers/ai-internal.controller.ts`
- `Integrations/AI/ai-service/src/health/health.controller.ts`
- `Integrations/AI/ai-service/src/ai/ai.module.ts`
- `Integrations/AI/ai-service/src/ai/security/tools/tool-schemas.ts`
- `Integrations/AI/ai-service/.env`
- `Integrations/AI/ai-service/.env.example`
- `docker-compose.yml`

## Runtime Behavior

### Booking Assistant
`BookingAgentService` now:
1. applies deterministic handlers for known intents
2. delegates complex orchestration to `BookingLangGraphWorkflow`
3. records sanitized turns through `PatientMemoryFacade`

### LangGraph Nodes
- `inputSafetyNode`
- `loadMemoryNode`
- `plannerNode`
- `toolExecutionNode`
- `responseValidationNode`
- `responseNode`

### Allowed Operations
LangGraph planner emits only:
- `searchClinics`
- `getClinicDoctors`
- `findAvailableSlots`
- `confirmBooking`
- `cancelBooking`
- `loadPatientMemory`

Mapped execution remains behind existing tool orchestrator APIs. No direct DB access is performed by LangGraph nodes.

## Deployment Steps

1. Ensure env:
   - `GEMINI_API_KEY=<key>`
   - `AI_PROVIDER=gemini`
   - `LANGGRAPH_ENABLED=true`
   - `OLLAMA_ENABLED=false`
2. Rebuild ai service:
   - `docker compose up -d --build ai-service`
3. Validate:
   - `GET /health/ready`
   - `POST /v1/ai/patient-booking-assistant`
4. Run tests:
   - `npx jest test/booking-langgraph.integration.spec.ts test/booking-leak-regression.spec.ts`

## Rollback

If rollback is needed, revert this migration commit and redeploy `ai-service`. No schema migration is required for this orchestration change.
