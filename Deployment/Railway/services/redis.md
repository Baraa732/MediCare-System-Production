# redis

Cache / rate-limit / session store. Private.

| Field | Value |
|---|---|
| Railway Service Name | `redis` |
| Image | `redis:7` (match compose) or Railway Redis plugin |
| Port | `6379` |
| Public / Private | **Private** |
| Password | `<redis-password>` (secret; require `--requirepass`) |
| Persistent volume | Recommended (`/data`) |
| Health Check | `redis-cli ping` → `PONG` |

## Used by
- api-gateway (rate limiting / sessions)
- auth-service (`REDIS_URL`)
- ai-service (optional)

## Connection string
```
redis://:<redis-password>@redis.railway.internal:6379
```

## Smoke test
```bash
redis-cli -u redis://:<redis-password>@redis.railway.internal:6379 ping
```
Expected: `PONG`.
