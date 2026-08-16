#!/bin/sh
# Wait until the Kafka broker TCP port accepts connections, then optionally until
# kafka-init sentinel topics exist (avoids Nest crash on UNKNOWN_TOPIC_OR_PARTITION).
# Uses KAFKA_HOST/KAFKA_PORT — never PORT/HOST (those clobber app listen ports via exec).
set -eu

BROKERS="${KAFKA_BROKERS:-kafka-1:9092}"
BROKER="${BROKERS%%,*}"
KAFKA_HOST="${BROKER%%:*}"
KAFKA_PORT="${BROKER##*:}"
READY_TOPIC="${KAFKA_READY_TOPIC:-audit.log}"
TOPIC_WAIT_ATTEMPTS="${KAFKA_TOPIC_WAIT_ATTEMPTS:-90}"
TOPIC_WAIT_SLEEP_SEC="${KAFKA_TOPIC_WAIT_SLEEP_SEC:-2}"

echo "Waiting for Kafka broker at ${KAFKA_HOST}:${KAFKA_PORT}..."
until nc -z "${KAFKA_HOST}" "${KAFKA_PORT}" 2>/dev/null; do
  echo "Kafka not ready at ${KAFKA_HOST}:${KAFKA_PORT}, retrying in 2s..."
  sleep 2
done
echo "Kafka broker port is open at ${KAFKA_HOST}:${KAFKA_PORT}"

# Prefer waiting for kafka-init topics when kafkajs is available in the image.
if command -v node >/dev/null 2>&1 && [ -d "./node_modules/kafkajs" ]; then
  echo "Waiting for Kafka topic '${READY_TOPIC}' (kafka-init sentinel)..."
  attempt=1
  while [ "${attempt}" -le "${TOPIC_WAIT_ATTEMPTS}" ]; do
    if node -e "
const { Kafka } = require('kafkajs');
const brokers = (process.env.KAFKA_BROKERS || 'kafka-1:9092').split(',').map((b) => b.trim()).filter(Boolean);
const topic = process.env.KAFKA_READY_TOPIC || 'audit.log';
(async () => {
  const kafka = new Kafka({ clientId: 'wait-for-kafka-topics', brokers, connectionTimeout: 8000, requestTimeout: 8000 });
  const admin = kafka.admin();
  try {
    await admin.connect();
    const meta = await admin.fetchTopicMetadata({ topics: [topic] });
    const ok = Array.isArray(meta?.topics) && meta.topics.some((t) => t.name === topic && Array.isArray(t.partitions) && t.partitions.length > 0);
    process.exit(ok ? 0 : 2);
  } catch (e) {
    process.exit(2);
  } finally {
    try { await admin.disconnect(); } catch (_) {}
  }
})();
" ; then
      echo "Kafka topic '${READY_TOPIC}' is available"
      break
    fi
    if [ "${attempt}" -eq "${TOPIC_WAIT_ATTEMPTS}" ]; then
      echo "WARNING: topic '${READY_TOPIC}' not ready after ${TOPIC_WAIT_ATTEMPTS} attempts; starting anyway (Nest will retry)"
      break
    fi
    echo "Topic '${READY_TOPIC}' not ready yet (attempt ${attempt}/${TOPIC_WAIT_ATTEMPTS}), retrying in ${TOPIC_WAIT_SLEEP_SEC}s..."
    sleep "${TOPIC_WAIT_SLEEP_SEC}"
    attempt=$((attempt + 1))
  done
else
  echo "Skipping topic wait (kafkajs not found); Nest start retry will handle race"
fi

exec "$@"
