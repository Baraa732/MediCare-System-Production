# Contributing

Thanks for looking at MediCare. This is a multi-service clinic platform — small, focused PRs are easier to review than sweeping refactors.

## Getting started

1. Clone the repo and copy `.env.example` → `.env` (fill secrets locally only).
2. `docker compose up -d --build` for the full stack.
3. Frontends run with Vite on the host — see [README.md](README.md#local-dashboards).

## Branching

- `main` — stable integration branch
- `feat/<short-name>` — new capability
- `fix/<short-name>` — bug fix
- `chore/<short-name>` — tooling, deps, CI

## Commits

Write commits like you'd explain the change to a teammate:

- Good: `appointment-service: let clinic admins list clinic schedule`
- Good: `clinic-admin: persist OTP resend cooldown across refresh`
- Avoid: `update files`, `misc fixes`, `AI changes`

## Pull requests

- Link the issue if one exists
- Note which services you touched (gateway, auth, a specific microservice, a dashboard)
- For API changes, mention the Postman collection you updated (if any)
- Screenshots help for UI work

## Code style

- **Backend:** NestJS patterns already in each microservice; match surrounding modules.
- **Frontend:** React + TypeScript; keep API calls in `src/lib/api/`.
- **Integrations:** edit `Integrations/WhatsApp/client/` first, then sync into services that copy it.

## Tests

There isn't full coverage yet. If you add behavior, add or extend tests where the service already has a `test/` or `*.spec.ts` setup.
