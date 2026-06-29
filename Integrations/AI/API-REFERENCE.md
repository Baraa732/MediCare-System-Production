# AI Patient Booking Assistant — Quick API Reference

## Endpoint

```
POST /api/v1/ai/patient-booking-assistant
```

**Auth:** Bearer token (Patient JWT)  
**Content-Type:** `application/json`

## Request Body

```typescript
{
  sessionId: string;  // Unique session ID (max 100 chars)
  message: string;    // User message (max 500 chars)
}
```

## Response

```typescript
{
  reply: string;  // AI assistant response
}
```

## Example Conversations

### 1. Book Appointment
```json
// Request 1
{
  "sessionId": "sess-abc-123",
  "message": "I want to book at Damascus Heart Center"
}

// Response 1
{
  "reply": "I found **Damascus Heart Center** at Al-Mazzeh Street...\n\nDoctors available:\n- **Dr. Ahmad Khalil** — Cardiology\n- **Dr. Layla Haddad** — Internal Medicine\n\nWhich doctor would you like?"
}

// Request 2
{
  "sessionId": "sess-abc-123",
  "message": "Anything tomorrow at 5 PM?"
}

// Response 2
{
  "reply": "**5:00 PM** on 2025-06-19 is available with **Dr. Ahmad Khalil**.\n\nWould you like me to book it?"
}

// Request 3
{
  "sessionId": "sess-abc-123",
  "message": "Yes, book it"
}

// Response 3
{
  "reply": "Done. Your appointment is confirmed.\n\n**Damascus Heart Center**\n**Dr. Ahmad Khalil**\n**2025-06-19 — 17:00**\n**Reference:** `appt-7f3a`\n\nPlease arrive 10–15 minutes early..."
}
```

### 2. View Appointments
```json
{
  "sessionId": "sess-xyz-456",
  "message": "What appointments do I have?"
}

// Response
{
  "reply": "You have **2** upcoming appointment(s):\n\n- **2025-06-23 09:00** — Dr. Ahmad, Damascus Heart Center (Confirmed)\n- **2025-06-26 14:30** — Dr. Youssef, Al-Noor Clinic (Confirmed)\n\nWould you like to reschedule or cancel any?"
}
```

### 3. FAQ
```json
{
  "sessionId": "sess-faq-789",
  "message": "What should I bring to my visit?"
}

// Response
{
  "reply": "Please bring your photo ID and insurance card to your appointment."
}
```

### 4. Non-Medical Query (Rejected)
```json
{
  "sessionId": "sess-test-999",
  "message": "What's the weather today?"
}

// Response
{
  "reply": "I can only help with medical appointments. For other matters, please contact support."
}
```

## Session State

Sessions are stored in Redis for 1 hour. The same `sessionId` maintains conversation context.

**Tracked state:**
- Selected clinic and doctor
- Chosen date and time slot
- Confirmation step
- Pending appointment details

## Intent Keywords

| Intent | Triggers |
|--------|----------|
| Search clinic | "find", "looking for", "clinic", "center" |
| Check slots | "tomorrow", "today", "available", "5 PM", "time" |
| Confirm booking | "yes", "confirm", "book it" (when pending) |
| View appointments | "my appointment", "upcoming", "what appointment" |
| Cancel flow | "cancel", "never mind", "stop" |
| FAQ | "bring", "prepare", "fasting", "documents" |

## Error Responses

### Slot Conflict
```json
{
  "reply": "Sorry — **5:00 PM** was just booked by someone else.\n\nStill available:\n- **5:30 PM**\n- **6:00 PM**\n\nWould you like me to book one of these instead?"
}
```

### Clinic Not Found
```json
{
  "reply": "I couldn't find that clinic. Try a different name or city."
}
```

### No Context
```json
{
  "reply": "Which clinic would you like to check? Please tell me the clinic name first."
}
```

## Rate Limiting

Default: **30 requests per 60 seconds** per patient  
Configurable via environment variables

## Security

✅ Medical-only queries enforced  
✅ JWT userId validation  
✅ Users can only access own appointments  
✅ Slot re-validation before booking  
✅ Session isolation per patient

## Testing with cURL

```bash
# Set your JWT token
TOKEN="your-patient-jwt-here"

# Start conversation
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1",
    "message": "Find Damascus Heart Center"
  }'

# Test non-medical rejection
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-2",
    "message": "Tell me a joke"
  }'
```

## Environment Setup

Required in `.env`:
```bash
REDIS_URL=redis://:password@redis:6379
CLINIC_SERVICE_URL=http://clinic-service:3002
SCHEDULING_SERVICE_URL=http://scheduling-service:3003
APPOINTMENT_SERVICE_URL=http://appointment-service:3007
INTERNAL_SERVICE_TOKEN=your-service-token
JWT_SECRET=your-jwt-secret

# Rate limiting (optional)
AI_RATE_LIMIT_MAX=30
AI_RATE_LIMIT_WINDOW_SECONDS=60
```

## Status Codes

- **200** — Success
- **400** — Invalid request (validation failed)
- **401** — Unauthorized (missing/invalid JWT)
- **429** — Rate limit exceeded
- **503** — AI service unavailable

## Notes

- Each `sessionId` maintains independent conversation state
- Sessions expire after 1 hour of inactivity
- Medical-only validation prevents abuse
- Always re-validates slots before booking to prevent conflicts

---

**Version:** 1.0  
**Documentation:** See `BOOKING-IMPLEMENTATION.md` for full details
