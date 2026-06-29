#!/bin/sh
# Single source of truth: Messaging/Kafka/kafka-config/topics/topics.config.ts
# Regenerate: cd kafka-config && npm run generate:kafka-init-sh
set -eu

BROKERS="${KAFKA_BROKERS:-kafka-1:9092}"

echo "Waiting for Kafka broker at ${BROKERS}..."
until kafka-broker-api-versions --bootstrap-server "${BROKERS}" >/dev/null 2>&1; do
  echo "Waiting for Kafka..."
  sleep 5
done

echo "Kafka available at ${BROKERS}"

create_topic() {
  topic_name="$1"
  partition_count="$2"
  retention_ms="$3"
  kafka-topics --bootstrap-server "${BROKERS}" \
    --create --if-not-exists \
    --topic "${topic_name}" \
    --partitions "${partition_count}" \
    --replication-factor 1 \
    --config "retention.ms=${retention_ms}"
}

# Standard topics (7 days)
create_topic user.create 3 604800000
create_topic user.create.reply 3 604800000
create_topic user.created 3 604800000
create_topic user.updated 3 604800000
create_topic user.deleted 3 604800000
create_topic user.status.updated 3 604800000
create_topic user.phone.verified 3 604800000
create_topic user.email.verified 3 604800000
create_topic user.password.changed 3 604800000
create_topic user.login.request 3 604800000
create_topic user.login.request.reply 3 604800000
create_topic user.login.success 3 604800000
create_topic user.verify.otp 3 604800000
create_topic account.linked 3 604800000
create_topic account.unlinked 3 604800000
create_topic user.link.patient.account 3 604800000
create_topic user.link.patient.account.reply 3 604800000
create_topic user.get.linked.accounts 3 604800000
create_topic user.get.linked.accounts.reply 3 604800000
create_topic user.unlink.account 3 604800000
create_topic user.unlink.account.reply 3 604800000
create_topic user.create.clinic.admin.pending 3 604800000
create_topic user.create.clinic.admin 3 604800000
create_topic clinic.admin.activate 3 604800000
create_topic system.manager.activate.clinic.admin 3 604800000
create_topic system.manager.activate.clinic.admin.reply 3 604800000
create_topic user.dashboard.activation.updated 3 604800000
create_topic system.manager.login 1 604800000
create_topic system.manager.created 1 604800000
create_topic user.create.by.admin 3 604800000
create_topic user.create.by.admin.reply 3 604800000
create_topic user.check.exists 3 604800000
create_topic user.check.exists.reply 3 604800000
create_topic audit.log 3 604800000
create_topic clinic.created 3 604800000
create_topic clinic.updated 3 604800000
create_topic clinic.deleted 3 604800000
create_topic clinic.staff.assigned 3 604800000
create_topic clinic.staff.removed 3 604800000
create_topic appointment.created 3 604800000
create_topic appointment.updated 3 604800000
create_topic appointment.cancelled 3 604800000
create_topic appointment.completed 3 604800000
create_topic schedule.updated 3 604800000
create_topic notification.sent 3 604800000
create_topic notification.failed 3 604800000
create_topic reminder.scheduled 3 604800000
create_topic reminder.sent 3 604800000
create_topic reminder.failed 3 604800000

# Dead-letter topics (30 days)
create_topic account.linked.dlt 1 2592000000
create_topic account.unlinked.dlt 1 2592000000
create_topic user.create.clinic.admin.pending.dlt 1 2592000000
create_topic clinic.admin.activate.dlt 1 2592000000
create_topic user.create.dlt 1 2592000000
create_topic user.verify.otp.dlt 1 2592000000
create_topic user.login.request.dlt 1 2592000000
create_topic user.check.exists.dlt 1 2592000000
create_topic user.link.patient.account.dlt 1 2592000000
create_topic user.unlink.account.dlt 1 2592000000
create_topic user.get.linked.accounts.dlt 1 2592000000
create_topic user.create.by.admin.dlt 1 2592000000
create_topic user.created.dlt 1 2592000000

echo "Topic initialization completed"
