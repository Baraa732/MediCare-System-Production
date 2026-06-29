# ✅ CORRECTED: LLM-Powered Booking Agent Implementation

## ⚠️ What Was Fixed

**BEFORE:** Simple rule-based regex matching (no real AI)  
**NOW:** Proper LLM-powered agent with tool calling via DeepSeek/Ollama

## How It Actually Works Now

### Agent Loop Architecture

```
User Message
    ↓
[Medical-Only Quick Filter]
    ↓
[Load Session Context]
    ↓
┌─────────────────────────────────┐
│   LLM Agent Loop (max 6 iter)  │
│                                 │
│  1. Build Prompt with Context   │
│  2. Send to LLM (DeepSeek/Oll) │
│  3. Parse Response:             │
│     - Tool Call? → Execute      │
│     - Answer? → Return          │
│  4. Add Tool Result to History  │
│  5. Loop back to LLM            │
└─────────────────────────────────┘
    ↓
Final Answer to User
```

### Advanced System Prompt

The agent now uses a **strong, detailed system prompt** that instructs the LLM:

1. **Medical-Only Enforcement**
```
STRICT RULES:
1. ONLY answer questions about: booking appointments, clinic info, availability
2. REJECT non-medical questions immediately
3. NEVER answer: weather, news, entertainment, shopping
4. DO NOT provide data user shouldn't access
```

2. **Tool Definitions** (JSON-based)
```
- search_clinics(query: string)
- list_doctors(clinicId: string)
- get_available_slots(clinicId, doctorId, date)
- book_appointment(clinicId, doctorId, slotId) [requires confirmation]
- get_upcoming_appointments()
- cancel_appointment(appointmentId, reason)
```

3. **Response Format**
```json
// For tool calls:
{"tool": "search_clinics", "params": {"query": "Damascus Heart"}}

// For final answer:
{"answer": "I found Damascus Heart Center..."}
```

4. **Natural Language Understanding**
- LLM extracts dates from "tomorrow", "next week"
- LLM extracts times from "5 PM", "afternoon"
- LLM understands context from previous turns

### Example Conversation Flow

**Turn 1:**
```
User: "I need to book at Damascus Heart Center tomorrow afternoon"

LLM analyzes → decides to:
1. Call search_clinics("Damascus Heart Center")
2. Get clinic info
3. Call get_available_slots(clinicId, anyDoctor, "2025-06-20")
4. Return: "Found Damascus Heart Center. Available slots tomorrow afternoon: ..."
```

**Turn 2:**
```
User: "5 PM works"

Context from session: clinicId, date known
LLM analyzes → decides to:
1. Filter slots for 5 PM (17:00)
2. Ask for confirmation: "Would you like me to book 5 PM with Dr. Ahmad?"
```

**Turn 3:**
```
User: "Yes"

LLM analyzes → decides to:
1. Call book_appointment(clinicId, doctorId, slotId)
2. Return confirmation with appointment ID
```

## Key Improvements Over Rule-Based

### ✅ Natural Language Understanding
- **Before:** Regex patterns like `/tomorrow|today/`
- **Now:** LLM understands "day after tomorrow", "this Friday", "next Monday at 3"

### ✅ Context Awareness
- **Before:** Hardcoded session.step state machine
- **Now:** LLM understands full conversation context, makes intelligent decisions

### ✅ Flexible Dialog
- **Before:** Fixed response templates
- **Now:** LLM generates natural, contextual responses

### ✅ Intent Detection
- **Before:** Simple keyword matching
- **Now:** LLM understands user intent semantically

### ✅ Tool Selection
- **Before:** Manual if/else logic
- **Now:** LLM decides which tools to call and in what order

## Prompt Engineering Details

### Session Context Injection
```typescript
// Before sending to LLM, we inject session state:
"Context: Currently looking at Damascus Heart Center (ID: 123)
Doctor: Dr. Ahmad Khalil
Date: 2025-06-20
Pending booking: 17:00 - AWAITING USER CONFIRMATION

User: Yes, book it"
```

This helps the LLM:
- Remember previous selections
- Know what user is confirming
- Make booking with correct parameters

### Medical-Only Pre-Filter
Quick keyword check **before** LLM (saves API calls):
```typescript
if (isNonMedicalQuery(message)) {
  return "I can only help with medical appointments...";
}
```

Then LLM handles edge cases like:
- "What's the weather for my clinic visit?" → FAQ answer
- "Calculate my travel time" → Redirected to booking help

### Tool Result Processing
After each tool call:
```
Assistant: [Called search_clinics]
Tool Result: {"data": {"clinics": [...]}}

[LLM processes result and decides next action]
```

## LLM Provider Selection

### Auto-Detection
```typescript
const useDeepSeek = this.deepSeekService.isConfigured();

if (useDeepSeek) {
  // Use DeepSeek API (cloud, powerful)
  await deepSeekService.generateChat(SYSTEM_PROMPT, prompt, {
    maxTokens: 800,
    temperature: 0.3  // Low temp for consistent tool calling
  });
} else {
  // Use Ollama (local, qwen3:4b)
  await ollamaService.generateChat(SYSTEM_PROMPT, prompt, {
    model: 'qwen3:4b',
    maxTokens: 600,
    temperature: 0.3
  });
}
```

### Temperature = 0.3
Low temperature ensures:
- Consistent JSON formatting
- Reliable tool calls
- Less creative hallucination
- Predictable medical responses

## Tool Execution Logic

```typescript
async executeTool(toolName, params, patientId, session) {
  switch (toolName) {
    case 'search_clinics':
      return await this.toolsService.searchClinics(params.query);
      
    case 'book_appointment':
      // Auto-fill from session if not provided
      const clinicId = params.clinicId || session.clinicId;
      const doctorId = params.doctorId || session.doctorId;
      const slotId = params.slotId || session.slotId;
      
      // Re-validate slot before booking
      return await this.toolsService.bookAppointment(
        patientId, clinicId, doctorId, slotId
      );
  }
}
```

Key features:
- Session data fallback (LLM doesn't need to repeat IDs)
- Patient ID injected securely from JWT
- Tool results returned to LLM for processing

## Session Auto-Update

```typescript
// After successful tool calls, update session:
if (toolName === 'search_clinics' && result.data?.clinics?.length === 1) {
  session.clinicId = clinic.id;
  session.clinicName = clinic.name;
  session.step = 'pick_doctor';
  await this.sessionService.save(sessionId, session);
}
```

This allows:
- Multi-turn conversations
- Context persistence
- Simplified follow-up queries

## Security Enforcement

### 1. Quick Pre-Filter (Fast)
```typescript
if (message.includes('weather') || message.includes('joke')) {
  return "I can only help with medical appointments";
}
```

### 2. LLM System Prompt (Strong)
```
STRICT RULES:
2. REJECT non-medical questions immediately
4. DO NOT provide data user shouldn't access
```

### 3. JWT Patient ID Enforcement
```typescript
// PatientId comes from JWT, not user input
await toolsService.bookAppointment(patientId, clinicId, doctorId, slotId);
```

### 4. Tool Access Control
- `get_upcoming_appointments()` → Only patient's own
- `book_appointment()` → Only for authenticated patient
- No admin tools exposed

## Error Handling

### Tool Execution Failures
```typescript
if (toolName === 'book_appointment' && result.error === 'CONFLICT') {
  // LLM will see error in tool result
  // LLM decides how to handle (refresh slots, apologize, etc.)
}
```

### LLM Failures
```typescript
try {
  const result = await this.callLLM(prompt);
} catch (error) {
  throw new BadRequestException('AI service temporarily unavailable');
}
```

### Max Iterations
```typescript
while (iteration < 6) {
  // Process...
}
// After 6 iterations:
return "I'm having trouble processing your request. Could you try rephrasing?";
```

## Response Parsing

### Flexible JSON Extraction
```typescript
// Handles multiple formats:
// 1. Clean JSON: {"tool": "search_clinics", "params": {...}}
// 2. Markdown wrapped: ```json\n{...}\n```
// 3. Mixed text: "I'll search for that. {"tool": ...}"
// 4. Plain text: "Damascus Heart Center is located..."

const jsonMatch = response.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[0]);
  if (parsed.tool) return parsed;  // Tool call
  if (parsed.answer) return parsed; // Final answer
}
// Fallback: treat entire response as answer
return { answer: response };
```

## Performance Optimizations

1. **Pre-filter non-medical** (no LLM call needed)
2. **Max 6 iterations** (prevent infinite loops)
3. **Temperature 0.3** (faster, more predictable)
4. **Session caching** (Redis, 1 hour TTL)
5. **Context injection** (LLM doesn't need to re-query)

## Testing the LLM Agent

### Test 1: Natural Language
```bash
curl -X POST .../patient-booking-assistant \
  -d '{
    "sessionId": "test-1",
    "message": "I need an appointment day after tomorrow around lunch time"
  }'

# LLM should:
# - Extract date: 2025-06-21
# - Understand "lunch time" ≈ 12:00-14:00
# - Search available slots in that window
```

### Test 2: Context Memory
```bash
# Turn 1
{"sessionId": "test-2", "message": "Find Damascus Heart Center"}

# Turn 2 (same session)
{"sessionId": "test-2", "message": "Show me tomorrow's slots"}

# LLM should remember clinicId from turn 1
```

### Test 3: Confirmation Handling
```bash
# Turn 1
{"message": "Book at clinic X tomorrow 5 PM"}

# LLM should respond: "Would you like me to book...?"

# Turn 2
{"message": "Yes"}

# LLM should call book_appointment tool
```

## Comparison: Before vs After

| Feature | Rule-Based (Before) | LLM-Powered (After) |
|---------|-------------------|-------------------|
| Intent detection | Regex keywords | Semantic understanding |
| Date parsing | `/tomorrow\|today/` | "day after tomorrow", "this Friday" |
| Context handling | Manual state machine | LLM memory + session |
| Response generation | Fixed templates | Natural, contextual |
| Tool selection | if/else logic | LLM decides dynamically |
| Flexibility | Rigid patterns | Handles variations |
| Prompt quality | N/A | **Strong, detailed system prompt** |

## Why This Is Better

1. **User Experience**
   - More natural conversations
   - Understands variations in phrasing
   - Contextual responses

2. **Maintainability**
   - No need to update regex for every pattern
   - LLM handles edge cases
   - Easier to add new capabilities

3. **Scalability**
   - Can add new tools without rewriting logic
   - LLM learns from system prompt
   - Fewer hardcoded rules

4. **Medical Safety**
   - Strong prompt enforcement
   - Pre-filter + LLM validation
   - No random data access

---

**Status:** ✅ Proper LLM-powered agent with strong prompts
**Build:** ✅ Compiled successfully
**Features:** Tool calling, context memory, natural language understanding
