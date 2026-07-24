# Rollback Procedures

Railway keeps immutable deployments per service. Rollback is per-service and does not
require code changes. Because MediCare is DB-per-service with async Kafka messaging,
follow the ordering rules below to avoid contract mismatches.

---

## 1. Single-service rollback (most common)

1. In Railway, open the service → **Deployments**.
2. Select the last known-good deployment → **Redeploy / Rollback**.
3. Wait for `/health/ready` to return `200`.
4. Run that service's smoke test from `post-deployment-tests.md`.

Use this for a bad image, a bad env change, or a crash loop.

### Env-only rollback
If the regression came from an environment variable change, restore the previous value
in **Variables** and redeploy — no image change needed.

---

## 2. Rollback order (reverse of deployment)

When rolling back multiple services, reverse the deploy tiers so callers roll back
before their dependencies change contract:

```
dashboards → api-gateway → system-manager → reminder → notification
→ appointment → scheduling → clinic / user / auth → observability → kafka/redis/db
```

Roll back only as far down the stack as required.

---

## 3. Database considerations

- After the one-time empty-database bootstrap, keep `DB_BOOTSTRAP=false` permanently;
  subsequent schema changes come only from migrations.
- **Prefer forward-fix over down-migrations.** Down-migrations that drop columns/tables can lose data.
- If a migration must be reverted and the service exposes a down step:
  ```bash
  npm run migration:revert   # verify the exact script in package.json
  ```
- Take a database snapshot/backup **before** rolling a service back to an image that
  expects an older schema. Restore the snapshot only if the newer schema is incompatible.
- If you roll back application code but keep the newer schema, confirm the older code
  tolerates the newer columns (usually yes for additive migrations).

---

## 4. Kafka considerations

- Topics created by `kafka-init` are durable; rolling back services does not delete them.
- In-flight/unconsumed messages remain in the topic. After rollback, a service resumes
  from its committed consumer offset — verify no poison messages block consumption.
- Do **not** delete topics as part of a rollback unless you intend to reset the event stream.

---

## 5. Full-platform rollback

1. Announce maintenance; optionally scale public services (gateway, dashboards) to 0 to stop ingress.
2. Snapshot every database.
3. Roll back services in the reverse-tier order above.
4. Re-run migrations only if a schema revert is required (see §3).
5. Re-run `post-deployment-tests.md` end-to-end.
6. Scale public services back up.

---

## 6. Emergency stop
- Scale `api-gateway`, `clinic-admin-dashboard`, `system-manager-dashboard` to **0 replicas** to immediately cut public access while backend/state stays intact.
- Backend services can keep running (they are private) while you investigate.

## 7. Post-rollback verification
- All `/health/ready` = `200`.
- Gateway `/health/ready` shows upstreams healthy.
- End-to-end sanity flow (`post-deployment-tests.md` §5) passes.
- No error spike in Grafana/Loki; traces flowing in Jaeger.
