# MediCare — System Manager Dashboard

Platform administration console for the MediCare clinic management system, built on
the **obsAdmin** theme (React 19 + TypeScript + MUI v9 + Vite + React Router v7).

The original Next.js dashboard was replaced with this Vite/MUI base; the real
MediCare platform features were re-implemented on top of the new design system, and
the observability theme pages are kept as a styled demo.

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3002
```

The dev server proxies every `/api/*` request to the NestJS gateway. Configure the
target in `.env.local`:

```
VITE_API_PROXY_TARGET=http://localhost:3000
```

The browser only ever talks to `http://localhost:3002`; it never calls the gateway
directly (CORS/Origin-safe, mirroring the previous Next.js proxy behaviour).

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`     | Dev server on port 3002 with API proxy |
| `npm run build`   | Type-check (`tsc -b`) + production build to `dist/` |
| `npm run preview` | Preview the production build on port 3002 |
| `npm run lint`    | ESLint                               |

## Authentication

Login is verified server-side by the gateway (`POST /api/system-manager/login`,
username + password). The session layer is hardened compared to the old dashboard:

- **Signed JWTs** decoded client-side only to read claims / expiry.
- **Automatic expiry** — `AuthGuard` re-validates the token on every navigation and
  schedules an auto-logout for the exact moment the token expires.
- **Brute-force lockout** — 5 failed attempts trigger a temporary client-side lock
  (the gateway remains the source of truth for real rate limiting).
- **`sessionStorage` persistence** + a `SameSite=Strict` (`Secure` on HTTPS) cookie,
  so the session is dropped when the tab closes.

> Note: true multi-factor auth requires gateway support and is not implemented here.

## Platform Features (real, backed by the gateway)

| Page              | Route                | Backend endpoints |
| ----------------- | -------------------- | ----------------- |
| Overview          | `/`                  | `GET /clinics`, `GET /users` |
| Activation Codes  | `/activation-codes`  | `POST /system-manager/activation-code/{generate,revoke}`, `GET .../status` |
| Clinics           | `/clinics`           | `GET/POST /clinics`, `GET /clinics/:id/staff` |
| Platform Users    | `/users`             | `GET /users` (paginated) |
| Administrators    | `/administrators`    | `POST /system-manager/create` |

API layer lives in `src/api/` (`client.ts`, `systemManager.ts`, `errors.ts`,
`types.ts`); shared data loading in `src/hooks/usePlatformData.ts`.

## Observability Theme Pages (demo data)

The obsAdmin theme pages are preserved under the **Observability / Synthetics /
Alerting** nav sections (Monitoring, Traces, Metrics, APM, Synthetics, Alerts,
Incidents, Integrations, Settings, Demo Data, Docs). They run on mock data and are
useful as UI references / building blocks.

> The upstream repo did not commit the `logs` page source (only its prebuilt
> bundle), so the **Logs** route was removed. Everything else is intact.

## Project Structure

```
src/
├── api/            # MediCare gateway client, endpoints, types, error mapping
├── hooks/          # usePlatformData (clinics/users/staff loader)
├── lib/            # auth (JWT decode/expiry), toast
├── store/          # authStore (real login), uiStore, settingsStore
├── components/     # StatCard, charts/, common/, guards/AuthGuard
├── layout/         # AppShell, Sidebar, Topbar, navConfig
├── theme/          # dark + light MUI themes
└── pages/
    ├── platform/   # Overview, ActivationCodes, Clinics, PlatformUsers, Administrators (real)
    ├── auth/       # Login, Forgot password
    └── ...         # Observability demo pages
```

## Theme

Dark-first with a light mode (toggle in the Topbar / Settings). All colours come
from `src/theme/index.ts`; see `THEME_GUIDE.md` for the full design-token reference.
