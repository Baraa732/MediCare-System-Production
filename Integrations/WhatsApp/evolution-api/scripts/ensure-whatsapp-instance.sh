#!/bin/sh
# Creates the default WhatsApp instance if Evolution has none (idempotent).
set -e

EVOLUTION_URL="${EVOLUTION_API_URL:-http://evolution-api:8080}"
API_KEY="${EVOLUTION_API_KEY:?EVOLUTION_API_KEY is required}"
INSTANCE_NAME="${WHATSAPP_INSTANCE_NAME:-MedicareTEST}"

echo "Waiting for Evolution API at ${EVOLUTION_URL}..."
until wget -qO- "${EVOLUTION_URL}/" >/dev/null 2>&1; do
  sleep 2
done

echo "Checking existing instances..."
LIST="$(wget -qO- --header="apikey: ${API_KEY}" "${EVOLUTION_URL}/instance/fetchInstances" 2>/dev/null || true)"

case "${LIST}" in
  *"\"name\":\"${INSTANCE_NAME}\""*|*"\"instanceName\":\"${INSTANCE_NAME}\""*)
    echo "Instance '${INSTANCE_NAME}' already exists."
    exit 0
    ;;
  "[]")
    echo "No instances found — creating '${INSTANCE_NAME}'..."
    ;;
  *)
    echo "Instance list: ${LIST}"
    ;;
esac

BODY="{\"instanceName\":\"${INSTANCE_NAME}\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}"
RESPONSE="$(wget -qO- --header="apikey: ${API_KEY}" --header="Content-Type: application/json" \
  --post-data="${BODY}" "${EVOLUTION_URL}/instance/create" 2>&1)" || true

echo "Create response: ${RESPONSE}"
echo "Done. Open http://localhost:8080/manager/ and scan QR to connect."
