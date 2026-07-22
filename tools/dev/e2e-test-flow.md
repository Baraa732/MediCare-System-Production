# E2E Test Flows (curl)

Run seed first:

```bash
node tools/dev/seed-e2e-test-data.mjs --clean
```

Load variables from `tools/dev/e2e-seed-output.json`.

```bash
API=http://localhost:3000/api
PASS=E2e@Test1
CLINIC_ID=e2e00002-0002-4002-8002-000000000002
DOCTOR_ID=e2e10002-0002-4002-8002-000000000002
PATIENT1_ID=e2e10004-0004-4004-8004-000000000004
DEVICE_ID=e2e-test-device-001
```

---

## FLOW 1 — System Manager → activation → clinic admin → MFA → dashboard

Uses **pre-seeded** clinic admin (`+963999009001`). Spare code `593816` / `+963999009099` is available for a fresh activation test once internal auth is healthy.

```bash
# 1) System Manager login
curl -s -X POST "$API/system-manager/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"Baraa Al-Rifaee","password":"baraaalrifaee732"}'

# 2) (Optional) Spare activation — may require internal auth fix in local stack
curl -s -X POST "$API/auth/clinic-admin/activate" \
  -H "Content-Type: application/json" \
  -d '{"code":"593816","phoneNumber":"+963999009099"}'

# 3) Clinic admin login (pre-seeded)
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963999009001","password":"'"$PASS"'"}'
# → use mfaToken + devOtp from response in development

# 4) Verify MFA
curl -s -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d '{"mfaToken":"<mfaToken>","otp":"<devOtp>","deviceId":"'"$DEVICE_ID"'"}'

# 5) Dashboard / clinics
curl -s "$API/clinics" -H "Authorization: Bearer <accessToken>"
```

---

## FLOW 2 — Doctor login → MFA → trusted device

```bash
# First login + MFA (trusts device)
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963999009010","password":"'"$PASS"'","deviceId":"'"$DEVICE_ID"'"}'

curl -s -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d '{"mfaToken":"<mfaToken>","otp":"<devOtp>","deviceId":"'"$DEVICE_ID"'"}'

# Second login — should bypass MFA on same deviceId
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963999009010","password":"'"$PASS"'","deviceId":"'"$DEVICE_ID"'"}'

curl -s "$API/appointments" -H "Authorization: Bearer <accessToken>"
```

---

## FLOW 3 — Secretary login → MFA (expected) → dashboard

```bash
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963999009002","password":"'"$PASS"'"}'

curl -s -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d '{"mfaToken":"<mfaToken>","otp":"<devOtp>"}'

curl -s "$API/appointments" -H "Authorization: Bearer <accessToken>"
```

---

## FLOW 4 — Patient books appointment → Kafka → notification → reminder

```bash
# Patient login + MFA
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963999009101","password":"'"$PASS"'"}'

curl -s -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d '{"mfaToken":"<mfaToken>","otp":"<devOtp>"}'

# Book appointment (future slot during clinic hours)
curl -s -X POST "$API/appointments" \
  -H "Authorization: Bearer <patientAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId":"'"$CLINIC_ID"'",
    "doctorId":"'"$DOCTOR_ID"'",
    "scheduledAt":"2026-07-03T10:00:00.000Z",
    "durationMinutes":30,
    "reason":"E2E booking test"
  }'

# Verify downstream: notification_service / reminder_service logs + Kafka topics
```

---

## FLOW 5 — Doctor opens patient EMR → audit log

```bash
# Doctor token from FLOW 2
curl -s "$API/emr/patients/$PATIENT1_ID" \
  -H "Authorization: Bearer <doctorAccessToken>"

# Verify audit row
docker exec postgres_auth psql -U clinic_user -d auth_db \
  -c "SELECT action, resource_type, resource_id, success FROM phi_audit_logs ORDER BY recorded_at DESC LIMIT 5;"
```

---

## Postman

Import the same requests. In development, read `devOtp` from login/MFA responses (dev phones `+963999009XXX` skip WhatsApp).
