# clinic-admin-dashboard

React (Vite) SPA served by Nginx. Public.

| Field | Value |
|---|---|
| Railway Service Name | `clinic-admin-dashboard` |
| Build Context | `./Frontend/React/clinic-admin-dashboard` |
| Dockerfile Path | `Dockerfile` |
| Build Args | `VITE_API_BASE_URL=https://<api-gateway-public-domain>` (**required**) |
| Start Command | *(image default: nginx)* |
| Port | container listens on `80` — set Railway target port to `80` |
| Public / Private | **Public** |
| Health Check | `GET /health` → `200` |

## API wiring (Railway)
The SPA calls the **public** API Gateway URL baked in at build time.
There is **no** Docker-DNS nginx proxy. Set:

```
VITE_API_BASE_URL=https://api-gateway-xxxx.up.railway.app
```

Gateway `ALLOWED_ORIGINS` must include this dashboard's public domain.

## Dependencies
- api-gateway (public domain + CORS)

## Smoke tests
```bash
curl -f https://<admin-dashboard-domain>/health
# From browser: login flow hits VITE_API_BASE_URL
```
