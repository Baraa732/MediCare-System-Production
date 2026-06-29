# Security

If you discover a vulnerability, please **do not** open a public issue with exploit details.

Email a short description and reproduction steps to the repository owner, or use GitHub's private vulnerability reporting if enabled.

## What we care about most

- Authentication bypass or privilege escalation across clinic tenants
- Exposure of PHI/PII through APIs or logs
- Leaked secrets in commits or container images
- Kafka/Redis/Postgres exposed without auth on non-local deployments

## Safe defaults in this repo

- `.env` files are gitignored; use `.env.example` as a template
- Services talk over Docker internal networks; only the API gateway and dashboards are published locally
- JWT + tenant headers enforced at the gateway for tenant-scoped routes
