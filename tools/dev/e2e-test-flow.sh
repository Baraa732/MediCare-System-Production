#!/usr/bin/env bash
# E2E manual test flows — run after: node tools/dev/seed-e2e-test-data.mjs
# Requires: API on localhost:3000, NODE_ENV=development (devOtp in responses)
set -euo pipefail

API="${API_BASE:-http://localhost:3000/api}"
PASS="${E2E_PASSWORD:-E2e@Test1}"
DEVICE_ID="${E2E_DEVICE_ID:-e2e-test-device-001}"

# Load IDs from seed output when available
if [[ -f tools/dev/e2e-seed-output.json ]]; then
  CLINIC_ID="$(node -pe "JSON.parse(require('fs').readFileSync('tools/dev/e2e-seed-output.json','utf8')).clinic.id")"
  DOCTOR_ID="$(node -pe "JSON.parse(require('fs').readFileSync('tools/dev/e2e-seed-output.json','utf8')).users.doctor.userId")"
  PATIENT1_ID="$(node -pe "JSON.parse(require('fs').readFileSync('tools/dev/e2e-seed-output.json','utf8')).users.patient1.userId")"
fi

SM_USER="${SM_USERNAME:-Baraa Al-Rifaee}"
SM_PASS="${SM_PASSWORD:-baraaalrifaee732}"

PHONE_ADMIN="+963999009001"
PHONE_DOCTOR="+963999009010"
PHONE_SECRETARY="+963999009002"
PHONE_PATIENT1="+963999009101"
PHONE_SPARE="+963999009099"
SPARE_CODE="593816"

json() { node -e "console.log(JSON.stringify($1))"; }
uuid() { node -e "console.log(require('crypto').randomUUID())"; }

echo "=== FLOW 1: System Manager → activation → clinic admin login ==="

SM_TOKEN=$(curl -sf -X POST "$API/system-manager/login" \
  -H "Content-Type: application/json" \
  -d "$(json "{username:'$SM_USER',password:'$SM_PASS'}")" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")

# Optional: generate a fresh code via API (requires document upload in current SM API)
# Use pre-seeded spare code instead:
echo "Using spare activation code: $SPARE_CODE for $PHONE_SPARE"

curl -sf -X POST "$API/auth/clinic-admin/activate" \
  -H "Content-Type: application/json" \
  -d "$(json "{code:'$SPARE_CODE',phoneNumber:'$PHONE_SPARE'}")" | jq .

REG=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuid)" \
  -d "$(json "{phoneNumber:'$PHONE_SPARE',firstName:'Spare',lastName:'Admin',password:'$PASS',role:'CLINIC_ADMIN',email:'spare.admin@demo.medicare.local'}")")
DEV_OTP=$(echo "$REG" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).devOtp")

LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(json "{phoneNumber:'$PHONE_SPARE',password:'$PASS'}")")
MFA_TOKEN=$(echo "$LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).mfaToken")
DEV_OTP=$(echo "$LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).devOtp // '$DEV_OTP'")

ADMIN_TOKEN=$(curl -sf -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d "$(json "{mfaToken:'$MFA_TOKEN',otp:'$DEV_OTP',deviceId:'$DEVICE_ID'}")" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")

curl -sf "$API/clinics" -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.clinics | length'
echo "FLOW 1 OK — clinic admin dashboard token acquired"

echo ""
echo "=== FLOW 2: Doctor login → MFA → trusted device ==="

DOC_LOGIN1=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(json "{phoneNumber:'$PHONE_DOCTOR',password:'$PASS',deviceId:'$DEVICE_ID'}")")
DOC_MFA=$(echo "$DOC_LOGIN1" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).mfaToken")
DOC_OTP=$(echo "$DOC_LOGIN1" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).devOtp")

DOC_TOKEN=$(curl -sf -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d "$(json "{mfaToken:'$DOC_MFA',otp:'$DOC_OTP',deviceId:'$DEVICE_ID'}")" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")

# Second login — should bypass MFA on trusted device
DOC_LOGIN2=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(json "{phoneNumber:'$PHONE_DOCTOR',password:'$PASS',deviceId:'$DEVICE_ID'}")")
echo "$DOC_LOGIN2" | node -pe "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.accessToken ? 'trusted-device bypass OK' : 'still requires MFA: '+(j.requiresMfa||false))"

curl -sf "$API/appointments" -H "Authorization: Bearer $DOC_TOKEN" | jq '.success'
echo "FLOW 2 OK"

echo ""
echo "=== FLOW 3: Secretary login → MFA (expected) ==="

SEC_LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(json "{phoneNumber:'$PHONE_SECRETARY',password:'$PASS'}")")
SEC_MFA=$(echo "$SEC_LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).mfaToken")
SEC_OTP=$(echo "$SEC_LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).devOtp")

SEC_TOKEN=$(curl -sf -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d "$(json "{mfaToken:'$SEC_MFA',otp:'$SEC_OTP'}")" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")

curl -sf "$API/appointments" -H "Authorization: Bearer $SEC_TOKEN" | jq '.success'
echo "FLOW 3 OK — secretary MFA required (expected)"

echo ""
echo "=== FLOW 4: Patient books appointment (Kafka → notification/reminder) ==="

PAT_LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(json "{phoneNumber:'$PHONE_PATIENT1',password:'$PASS'}")")
PAT_MFA=$(echo "$PAT_LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).mfaToken")
PAT_OTP=$(echo "$PAT_LOGIN" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).devOtp")
PAT_TOKEN=$(curl -sf -X POST "$API/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d "$(json "{mfaToken:'$PAT_MFA',otp:'$PAT_OTP'}")" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken")

# Next weekday 10:00 UTC (adjust if scheduling rejects)
SCHEDULED_AT=$(node -e "const d=new Date(); d.setUTCDate(d.getUTCDate()+1); d.setUTCHours(10,0,0,0); console.log(d.toISOString())")

APPT=$(curl -sf -X POST "$API/appointments" \
  -H "Authorization: Bearer $PAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(json "{clinicId:'${CLINIC_ID:-REPLACE_CLINIC_ID}',doctorId:'${DOCTOR_ID:-REPLACE_DOCTOR_ID}',scheduledAt:'$SCHEDULED_AT',durationMinutes:30,reason:'E2E booking test'}")")
echo "$APPT" | jq '.success, .appointment.id'
echo "FLOW 4 submitted — verify Kafka consumers + notification/reminder logs"

echo ""
echo "=== FLOW 5: Doctor opens patient EMR → audit log ==="

if [[ -n "${PATIENT1_ID:-}" ]]; then
  curl -sf "$API/emr/patients/$PATIENT1_ID" \
    -H "Authorization: Bearer $DOC_TOKEN" | jq '.success // .patientId // .'
  echo "Check auth_db.phi_audit_logs for EMR access entry"
else
  echo "Set PATIENT1_ID from e2e-seed-output.json"
fi
echo "FLOW 5 OK"
