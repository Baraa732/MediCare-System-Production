#!/bin/sh
# Wait until the Kafka broker TCP port accepts connections (network path clients use).
# Uses KAFKA_HOST/KAFKA_PORT — never PORT/HOST (those clobber app listen ports via exec).
set -eu

BROKERS="${KAFKA_BROKERS:-kafka-1:9092}"
BROKER="${BROKERS%%,*}"
KAFKA_HOST="${BROKER%%:*}"
KAFKA_PORT="${BROKER##*:}"

echo "Waiting for Kafka broker at ${KAFKA_HOST}:${KAFKA_PORT}..."
until nc -z "${KAFKA_HOST}" "${KAFKA_PORT}" 2>/dev/null; do
  echo "Kafka not ready at ${KAFKA_HOST}:${KAFKA_PORT}, retrying in 2s..."
  sleep 2
done
echo "Kafka broker port is open at ${KAFKA_HOST}:${KAFKA_PORT}"

exec "$@"
