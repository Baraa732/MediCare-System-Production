# zookeeper-1

Coordination for Kafka. Private. Deploy before Kafka.

| Field | Value |
|---|---|
| Railway Service Name | `zookeeper-1` |
| Image | `confluentinc/cp-zookeeper` (match compose tag) |
| Port | `2181` |
| Public / Private | **Private** |
| Persistent volume | Recommended (data + log dirs) |
| Health Check | TCP `2181` reachable |

## Required environment variables
| Var | Value |
|---|---|
| `ZOOKEEPER_CLIENT_PORT` | `2181` |
| `ZOOKEEPER_TICK_TIME` | `2000` |

## Used by
- kafka-1

## Smoke test
```bash
nc -z zookeeper-1.railway.internal 2181 && echo ok
```
Expected: `ok`.
