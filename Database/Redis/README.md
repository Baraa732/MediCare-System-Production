# Redis

Sessions, rate limits, JWT cache.

| Compose service | Used by |
|-----------------|---------|
| `redis` | auth-service, api-gateway |

Credentials: root `.env` → `REDIS_PASSWORD`.
