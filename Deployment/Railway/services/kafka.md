# kafka-1 (+ kafka-init)

Event bus for inter-service messaging. Private. Deploy after Zookeeper.

| Field | Value |
|---|---|
| Railway Service Name | `kafka-1` |
| Image | `confluentinc/cp-kafka:7.4.0` |
| Port | `9092` |
| Public / Private | **Private** |
| Advertised listener | `PLAINTEXT://kafka-1.railway.internal:9092` |
| Persistent volume | **Required** (log dirs) |
| Health Check | broker API versions reachable on `9092` |

## Required environment variables (kafka-1)
| Var | Value |
|---|---|
| `KAFKA_BROKER_ID` | `1` |
| `KAFKA_ZOOKEEPER_CONNECT` | `zookeeper-1.railway.internal:2181` |
| `KAFKA_LISTENERS` | `PLAINTEXT://0.0.0.0:9092` |
| `KAFKA_ADVERTISED_LISTENERS` | `PLAINTEXT://kafka-1.railway.internal:9092` |
| `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP` | `PLAINTEXT:PLAINTEXT` |
| `KAFKA_INTER_BROKER_LISTENER_NAME` | `PLAINTEXT` |
| `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR` | `1` |
| `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR` | `1` |
| `KAFKA_TRANSACTION_STATE_LOG_MIN_ISR` | `1` |
| `KAFKA_DEFAULT_REPLICATION_FACTOR` | `1` |
| `KAFKA_MIN_INSYNC_REPLICAS` | `1` |
| `KAFKA_AUTO_CREATE_TOPICS_ENABLE` | `"false"` |
| `KAFKA_LOG_RETENTION_HOURS` | `168` |
| `KAFKA_HEAP_OPTS` | `-Xms256m -Xmx512m` |

## kafka-init (Railway one-shot) — REQUIRED

Topic auto-creation is disabled. Topics must be created before microservices start.

### Build (no bind mounts)
| Field | Value |
|---|---|
| Railway Service Name | `kafka-init` |
| Build Context | `.` (repo root) |
| Dockerfile Path | `Messaging/Kafka/scripts/Dockerfile.kafka-init` |
| Env | `KAFKA_BROKERS=kafka-1.railway.internal:9092` |
| Behavior | Idempotent (`--create --if-not-exists`, RF=1) |

### How to run on Railway
1. Deploy `kafka-1` and wait until healthy.
2. Deploy `kafka-init` once (or run as a Railway one-off / temporary service).
3. Confirm logs: `Topic initialization completed`.
4. Stop / remove the `kafka-init` service (or leave it stopped).
5. Only then deploy Nest microservices.

Safe to re-run after Kafka restarts.

### Smoke test
```bash
kafka-topics --bootstrap-server kafka-1.railway.internal:9092 --list
```
Expected: topics from `kafka-init.sh` are listed.
