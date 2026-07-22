#!/usr/bin/env bash
# Kafka ACL bootstrap for MediCare production (run after SASL users are created).
# Requires kafka-acls CLI and broker admin credentials.
set -euo pipefail

BROKER="${KAFKA_BROKER:-kafka-1:9092}"
ADMIN_CONFIG="${KAFKA_ADMIN_CONFIG:-/etc/kafka/admin.properties}"

acl_producer() {
  local user="$1"
  local topic="$2"
  kafka-acls --bootstrap-server "$BROKER" --command-config "$ADMIN_CONFIG" \
    --add --allow-principal "User:${user}" --operation Write --topic "$topic"
}

acl_consumer() {
  local user="$1"
  local group="$2"
  local topic="$3"
  kafka-acls --bootstrap-server "$BROKER" --command-config "$ADMIN_CONFIG" \
    --add --allow-principal "User:${user}" --operation Read --topic "$topic"
  kafka-acls --bootstrap-server "$BROKER" --command-config "$ADMIN_CONFIG" \
    --add --allow-principal "User:${user}" --operation Read --group "$group"
}

echo "Applying MediCare Kafka ACLs on ${BROKER}..."

# appointment-service
for t in appointment.created appointment.updated appointment.cancelled appointment.completed; do
  acl_producer appointment-service "$t"
done
acl_consumer notification-service notification-service-consumer appointment.created
acl_consumer notification-service notification-service-consumer appointment.updated
acl_consumer notification-service notification-service-consumer appointment.cancelled
acl_consumer reminder-service reminder-service-consumer appointment.created
acl_consumer reminder-service reminder-service-consumer appointment.updated
acl_consumer reminder-service reminder-service-consumer appointment.cancelled
acl_consumer reminder-service reminder-service-consumer appointment.completed

# user-service -> emr-service
acl_producer user-service user.created
acl_consumer emr-service emr-service-consumer user.created

# audit.log
acl_producer system-manager-service audit.log
acl_producer appointment-service audit.log
acl_producer user-service audit.log
acl_producer emr-service audit.log
acl_consumer auth-service auth-service-consumer audit.log

echo "Kafka ACL bootstrap complete."
