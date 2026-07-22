# ADR-004: Kafka Async Communication

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

Appointment lifecycle events must fan out to notification, reminder, and audit consumers without blocking the booking HTTP response. User creation must trigger EMR sync. Auth flows use request-reply over Kafka for user-service integration.

## Decision

Use **Apache Kafka** (Confluent 7.4, single broker in Docker Compose) as the async event bus:

- **Topic registry:** `Messaging/Kafka/kafka-config/topics/topics.config.ts` — 40+ topics with DLT companions
- **Init:** `kafka-init` one-shot container creates topics before services start
- **Producers:** Signed event envelopes via `SignedKafkaPublisher` / `createSignedKafkaEnvelope`
- **Consumers:** `withSecuredKafkaEvent()` — envelope verification, idempotency, tenant corroboration
- **Security matrix:** `KAFKA_TOPIC_SECURITY_MATRIX` defines allowed producers/consumers per topic
- **Idempotency:** `processed_kafka_messages` table in notification-service and reminder-service
- **DLT:** `.dlt` topics for manual intervention (e.g., `user.created.dlt`)
- **Outbox:** user-service transactional outbox (`outbox_events`) polled every 5s

**Key event flows:**
- `appointment.created` → notification-service, reminder-service
- `user.created` → emr-service (OpenEMR patient sync)
- `user.password.changed` → auth-service
- `audit.log` → auth-service (centralized PHI audit ingestion)

## Consequences

### Positive
- Decoupled side effects — booking returns before notification sends
- At-least-once delivery with idempotency guards
- Topic-level producer/consumer ACL via security matrix
- Tenant corroboration prevents spoofed cross-tenant events

### Negative
- Single broker = SPOF; RF=1 in dev compose
- Eventual consistency — notification may lag seconds behind booking
- Zookeeper dependency (legacy Kafka architecture)
- Not all topics in security matrix (only actively secured subset)

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Kafka broker down | High | Services block startup on kafka-init; P1: broker health alerting |
| Duplicate notifications | Low | processed_kafka_messages + eventId |
| Outbox poll lag | Low | 5s interval; batch 50 |
| Message retention disk growth | Medium | 7-day retention configured; 1GB per partition cap |

## Alternatives Considered

1. **Redis Pub/Sub** — Rejected: no persistence, no replay, no DLT.
2. **RabbitMQ** — Rejected: team standardized on Kafka; NestJS microservices Kafka transport already integrated.
3. **Direct HTTP fan-out from appointment-service** — Rejected: tight coupling; booking latency increase.
