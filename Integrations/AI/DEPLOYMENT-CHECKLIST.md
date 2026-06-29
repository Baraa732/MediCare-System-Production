# 🚀 Deployment Checklist — AI Patient Booking Assistant

## ✅ Implementation Status

All files created and TypeScript compilation successful!

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration
```bash
# Edit ai-service/.env and add:

CLINIC_SERVICE_URL=http://clinic-service:3002
SCHEDULING_SERVICE_URL=http://scheduling-service:3003
APPOINTMENT_SERVICE_URL=http://appointment-service:3007
INTERNAL_SERVICE_TOKEN=<your-service-token>
JWT_SECRET=<your-jwt-secret>
REDIS_URL=redis://:password@redis:6379

# Optional: Rate limiting
AI_RATE_LIMIT_MAX=30
AI_RATE_LIMIT_WINDOW_SECONDS=60
```

### 2. Service Endpoints Verification

Ensure these microservices are running and accessible:

- [ ] **clinic-service** (port 3002)
  - `GET /v1/clinics/search?q={query}`
  - `GET /v1/clinics/{id}/doctors`

- [ ] **scheduling-service** (port 3003)
  - `GET /v1/schedule/slots?clinicId&doctorId&date`
  - `POST /v1/schedule/validate-slot`

- [ ] **appointment-service** (port 3007)
  - `POST /v1/appointments`
  - `PATCH /v1/appointments/{id}`
  - `PATCH /v1/appointments/{id}/status`
  - `POST /v1/appointments/internal/patient-upcoming-summary`

### 3. Redis Verification

- [ ] Redis is running and accessible
- [ ] REDIS_URL is correctly configured
- [ ] Test connection: `redis-cli ping` → PONG

### 4. Internal Service Token

- [ ] Generate secure service token
- [ ] Configure in all microservices
- [ ] Add to ai-service `.env`

### 5. Build & Test

```bash
cd ai-service

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build
# ✅ Should complete without errors

# Start service (development)
npm run start:dev

# Or production
npm run start:prod
```

### 6. Health Check

```bash
# Test service is running
curl http://localhost:3005/health

# Test AI status (requires auth)
curl -H "Authorization: Bearer <JWT>" \
     http://localhost:3005/v1/ai/status
```

### 7. API Gateway Configuration

Ensure API Gateway routes to ai-service:
```
POST /api/v1/ai/patient-booking-assistant → ai-service:3005
```

## 🧪 Testing Checklist

### Test 1: Basic Search
```bash
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer <PATIENT_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-1",
    "message": "Find Damascus Heart Center"
  }'

# Expected: Should return clinic info + doctors list
```

### Test 2: Non-Medical Query (Security)
```bash
curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
  -H "Authorization: Bearer <PATIENT_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-2",
    "message": "What is the weather today?"
  }'

# Expected: "I can only help with medical appointments..."
```

### Test 3: Session Persistence
```bash
# Request 1 - Search clinic
curl -X POST ... -d '{"sessionId": "test-3", "message": "Find clinic X"}'

# Request 2 - Same session, check slots (should remember clinic)
curl -X POST ... -d '{"sessionId": "test-3", "message": "Any slots tomorrow?"}'

# Expected: Should use clinic from previous request
```

### Test 4: Rate Limiting
```bash
# Send 31+ requests rapidly
for i in {1..35}; do
  curl -X POST http://localhost:3005/v1/ai/patient-booking-assistant \
    -H "Authorization: Bearer <PATIENT_JWT>" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"test-$i\", \"message\": \"test\"}"
done

# Expected: Should get 429 after hitting limit
```

## 🔒 Security Verification

- [ ] Non-medical queries are rejected
- [ ] JWT validation is enforced
- [ ] Users can only see their own appointments
- [ ] Rate limiting is active
- [ ] Internal service token is used for microservice calls
- [ ] Session state is isolated per patient

## 📊 Monitoring

### Logs to Watch
```bash
# AI service logs
docker logs ai-service -f

# Look for:
# - "Patient chat source: template" (FAQ mode)
# - "BookingAgentService" intent detection
# - HTTP client warnings (service unavailable)
```

### Redis Session Inspection
```bash
redis-cli
> KEYS booking:session:*
> GET booking:session:<sessionId>
> TTL booking:session:<sessionId>
```

### Metrics Endpoint
```bash
curl -H "Authorization: Bearer <SYSTEM_MANAGER_JWT>" \
     http://localhost:3005/v1/ai/metrics
```

## 🐛 Troubleshooting

### Issue: "No service token"
**Fix:** Add `INTERNAL_SERVICE_TOKEN` to `.env`

### Issue: "Redis connection failed"
**Fix:** Check `REDIS_URL` format: `redis://:password@host:6379`

### Issue: "Slot validation always fails"
**Fix:** Ensure scheduling-service `/validate-slot` endpoint exists

### Issue: "Clinic not found"
**Fix:** Verify clinic-service `/search` endpoint is working

### Issue: Build errors
**Fix:** Run `npm install` to update dependencies

## 📈 Production Deployment

### Docker
```bash
# Build image
docker build -t ai-service:booking-v1 .

# Run with env vars
docker run -d \
  --name ai-service \
  --env-file .env \
  -p 3005:3005 \
  ai-service:booking-v1
```

### Docker Compose
Already configured in main `docker-compose.yml`

### Health Checks
Add to docker-compose.yml:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3005/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## 🎯 Success Criteria

✅ Service builds without errors  
✅ All endpoints respond with 200/400 (not 500)  
✅ Non-medical queries are rejected  
✅ Sessions persist in Redis  
✅ Rate limiting works  
✅ Slot conflicts are handled gracefully  
✅ Booking confirmation returns appointment ID

## 📚 Documentation Reference

- **API Reference:** `API-REFERENCE.md`
- **Implementation Details:** `BOOKING-IMPLEMENTATION.md`
- **Feature Scenarios:** `AI-Assistant.md`
- **Quick Summary:** `IMPLEMENTATION-SUMMARY.md`

## 🔄 Rollback Plan

If issues arise:
```bash
# Stop new service
docker stop ai-service

# Revert to previous version
docker run -d --name ai-service ai-service:previous-version

# Or disable endpoint at API Gateway level
```

---

**Status:** Ready for deployment ✅  
**Risk Level:** Low (no infra changes, new endpoint only)  
**Rollback:** Easy (disable endpoint or revert container)
