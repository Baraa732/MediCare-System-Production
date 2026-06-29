# AI Patient Booking Assistant — Implementation Notes

## Overview

The AI Patient Booking Assistant is now implemented in `ai-service`. It provides a conversational interface for patients to book, reschedule, and manage medical appointments through natural language.

**Endpoint:** `POST /api/v1/ai/patient-booking-assistant`

**Payload:**
```json
{
  "sessionId": "unique-session-id",
  "message": "I want to book at Damascus Heart Center tomorrow at 5 PM"
}
```

**Auth:** Patient JWT via API Gateway

## Architecture

```
Patient App → API Gateway → ai-service (booking-agent) → Redis (session)
                                      ↓
                            booking-tools (executor)
                                      ↓
                   ┌──────────────────┼──────────────────┐
                   ↓                  ↓                  ↓
            clinic-service   scheduling-service   appointment-service
```

## Implementation Components

### 1. DTOs
- `booking-assistant.dto.ts` — Request validation (sessionId, message)

### 2. HTTP Clients
- `clinic-http.client.ts` — Search clinics, list doctors
- `scheduling-http.client.ts` — Get available slots, validate slots
- `appointment-http.client-v2.ts` — Book, update, cancel appointments

### 3. Services
- `booking-session.service.ts` — Redis session management (1 hour TTL)
- `booking-tools.service.ts` — Tool executor (6 functions)
- `booking-agent.service.ts` — Conversational agent with medical-only validation

### 4. Controller
- `ai.controller.ts` — Added `/patient-booking-assistant` endpoint

## Security Features

### Medical-Only Validation
The agent **rejects non-medical queries** immediately:
- **Allowed:** appointments, clinics, doctors, medical visit preparation
- **Blocked:** weather, news, shopping, entertainment, random data access

**Examples:**
- ✅ "Book appointment tomorrow" → Processed
- ✅ "What should I bring to my visit?" → FAQ answer
- ❌ "What's the weather today?" → "I can only help with medical appointments"
- ❌ "Tell me a joke" → Redirected to appointment help

### Data Access Control
- Users can only access **their own** appointments (enforced by JWT `userId`)
- No random data queries allowed
- Session state tied to specific patient

## Conversation Flow

### Example 1: Happy Path
```
User: "Find Damascus Heart Center"
AI: Lists clinic + doctors

User: "Anything tomorrow at 5 PM?"
AI: Shows available slots at 5 PM

User: "Yes, book it"
AI: ✅ Confirmed with appointment reference
```

### Example 2: Slot Conflict
```
User: "Yes, book it"
AI: Validates slot → CONFLICT
    Refreshes available slots
    Offers alternatives
```

### Example 3: Non-Medical Query
```
User: "What's the weather today?"
AI: "I can only help with medical appointments. For other matters, please contact support."
```

## Session State

Stored in Redis with 1-hour TTL:
```typescript
{
  clinicId: string
  clinicName: string
  doctorId: string
  doctorName: string
  date: string
  slotId: string
  slotTime: string
  appointmentId: string
  step: 'pick_clinic' | 'pick_doctor' | 'pick_slot' | 'confirm' | 'completed'
  candidates: Clinic[]  // For multiple clinic matches
}
```

## Tool Functions

1. **search_clinics** — `GET /v1/clinics/search?q={query}`
2. **list_doctors** — `GET /v1/clinics/{id}/doctors`
3. **get_available_slots** — `GET /v1/schedule/slots?clinicId&doctorId&date`
4. **book_appointment** — `POST /v1/appointments` (validates slot first)
5. **update_appointment** — `PATCH /v1/appointments/{id}` (validates new slot)
6. **cancel_appointment** — `PATCH /v1/appointments/{id}/status`
7. **get_upcoming_appointments** — Internal endpoint for patient's appointments

## Intent Detection

Simple rule-based detection:
- `search_clinic` — Keywords: find, looking for, clinic, center
- `check_slots` — Keywords: tomorrow, today, available, time, PM, AM
- `confirm_booking` — Keywords: yes, confirm, book it (when step=confirm)
- `view_appointments` — Keywords: my appointment, upcoming, what appointment
- `cancel_flow` — Keywords: cancel, never mind, stop (when no "appointment")
- `general` — FAQ fallback (fasting, documents, preparation)

## Rate Limiting

Uses existing `ai-rate-limit.service.ts`:
- Default: 30 requests per 60 seconds per user
- Configurable via `AI_RATE_LIMIT_MAX` and `AI_RATE_LIMIT_WINDOW_SECONDS`

## Environment Variables

Add to `.env`:
```bash
CLINIC_SERVICE_URL=http://clinic-service:3002
SCHEDULING_SERVICE_URL=http://scheduling-service:3003
APPOINTMENT_SERVICE_URL=http://appointment-service:3007
INTERNAL_SERVICE_TOKEN=your-service-token
```

## Testing

### Manual Test with cURL
```bash
# Search clinic
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer PATIENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1",
    "message": "Find Damascus Heart Center"
  }'

# Check slots
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer PATIENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1",
    "message": "Anything tomorrow at 5 PM?"
  }'

# Confirm booking
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer PATIENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1",
    "message": "Yes, book it please"
  }'

# Test non-medical rejection
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer PATIENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-2",
    "message": "What is the weather today?"
  }'
```

## Future Enhancements (Not Implemented)

The current implementation is **minimal and functional**. For production, consider:

1. **LLM Integration** — Use DeepSeek/Ollama for better natural language understanding (currently rule-based)
2. **Multi-language** — Arabic support for Syrian patients
3. **Appointment History** — "Show my past appointments"
4. **Doctor Preferences** — "Book with my usual doctor"
5. **Insurance Validation** — Check coverage before booking
6. **Reminder Integration** — SMS/WhatsApp notifications
7. **Analytics** — Track booking success rate, common failures

## Notes

- **No over-engineering:** Simple rule-based intent detection (no LLM overhead for basic flows)
- **Medical-only enforced:** Rejects non-medical queries immediately
- **Slot validation:** Always re-validates before write to prevent conflicts
- **Session isolation:** Each patient has isolated session state
- **Graceful degradation:** If microservices fail, returns helpful error messages

## Maintenance

- **Session TTL:** 1 hour (configurable in `booking-session.service.ts`)
- **Cache:** Not used for booking (always fresh data)
- **Logs:** Check `BookingAgentService` logs for conversation flows
- **Metrics:** Tracked via existing `ai-metrics.service.ts`

---

**Implementation Date:** 2025
**Status:** Production-ready minimal implementation
**Documentation Reference:** `AI-Assistant.md` (scenarios 1-10)
