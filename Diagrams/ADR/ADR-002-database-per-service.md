# ADR-002: Database Per Service

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-03 |
| **Deciders** | Platform Architecture Team |

## Context

MediCare services own distinct data domains. Shared tables would create tight coupling, complicate migrations, and amplify blast radius on schema changes. Healthcare workloads require auditability per domain.

## Decision

Implement **database-per-service** using dedicated PostgreSQL 15 containers:

| Database | Owning service | Key tables |
|----------|---------------|------------|
| auth_db | auth-service | sessions, otps, audit_logs, phi_audit_logs, rate_limits |
| user_db | user-service | users, outbox_events, processed_messages |
| clinic_db | clinic-service | tenants, tenant_staff_assignments |
| appointment_db | appointment-service | appointments, patient_clinic_relations, doctor_patient_assignments |
| scheduling_db | scheduling-service | clinic_hours, doctor_availability, schedule_blocks |
| notification_db | notification-service | notification_logs, staff_inbox, push_device_tokens |
| reminder_db | reminder-service | scheduled_reminders, processed_kafka_messages |
| emr_db | emr-service | patient_emr_links, openemr_oauth_config |
| system_db | system-manager-service | system_managers, activation_codes, platform_incidents |

**Exceptions (intentional):**
- `auth-service` also reads `system_db` for system-manager token validation
- `system-manager-service` opens a read pool to `clinic_db` for platform stats (cross-DB read)
- OpenEMR uses MariaDB (`mariadb-openemr`) — external EHR, not owned schema
- Evolution API uses `evolution_db` + MongoDB — WhatsApp integration

**Foreign keys across databases are prohibited.** References use UUIDs validated via internal HTTP or Kafka corroboration.

## Consequences

### Positive
- Independent migration pipelines per service (TypeORM migrations)
- Failure isolation — `notification_db` outage does not block appointment writes
- Per-DB connection pool tuning possible

### Negative
- No cross-DB ACID transactions — appointment + notification consistency is eventual
- Cross-service reads require HTTP fan-out (N+1 risk on dashboards)
- 9 Postgres instances × 512 MB = ~4.5 GB baseline RAM on host
- Backup complexity — 10 databases to protect

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Orphaned references (user deleted, appointment remains) | Medium | Soft-delete patterns; Kafka user.deleted (future) |
| system-manager direct clinic_db access | Low | Read-only pool; consider API delegation |
| Backup not automated | **Critical** | P0: enable pg_dump cron or pgBackRest |

## Alternatives Considered

1. **Shared single Postgres, schema-per-service** — Rejected: weaker blast-radius isolation; connection pool contention.
2. **DB-per-tenant** — Rejected: operational cost at 100+ clinics; current shared-schema + tenant_id sufficient.
3. **CQRS read replicas** — Deferred: not needed before 100 clinics.
