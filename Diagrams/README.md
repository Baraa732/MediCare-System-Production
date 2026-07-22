# MediCare Architecture Diagrams

Phase Final deliverable — Architecture Deep Audit (2026-07-03).

## Diagrams

| # | File | Description |
|---|------|-------------|
| 1 | [01-context-diagram.md](./01-context-diagram.md) | System context — users, gateway, services, databases |
| 2 | [02-container-diagram.md](./02-container-diagram.md) | Container diagram — all microservices and infrastructure |
| 3 | [03-sequence-appointment-booking.md](./03-sequence-appointment-booking.md) | Appointment booking sequence with Kafka fan-out |
| 4 | [04-multi-tenant-isolation.md](./04-multi-tenant-isolation.md) | Multi-tenant isolation across services |
| 5 | [05-failure-handling.md](./05-failure-handling.md) | Retry, outbox, idempotency, circuit breakers |
| 6 | [06-deployment-diagram.md](./06-deployment-diagram.md) | Docker deployment topology |

## Architecture Decision Records

| ADR | File |
|-----|------|
| ADR-001 | [Microservices architecture](./ADR/ADR-001-microservices-architecture.md) |
| ADR-002 | [Database per service](./ADR/ADR-002-database-per-service.md) |
| ADR-003 | [Multi-tenancy strategy](./ADR/ADR-003-multi-tenancy-strategy.md) |
| ADR-004 | [Kafka async communication](./ADR/ADR-004-kafka-async-communication.md) |
| ADR-005 | [OpenEMR integration strategy](./ADR/ADR-005-openemr-integration-strategy.md) |
| ADR-006 | [Internal HMAC authentication](./ADR/ADR-006-internal-hmac-authentication.md) |
| ADR-007 | [Tenant isolation enforcement](./ADR/ADR-007-tenant-isolation-enforcement.md) |
| ADR-008 | [Observability architecture](./ADR/ADR-008-observability-architecture.md) |

## Full Audit Report

[PHASE_FINAL_ARCHITECTURE_AUDIT.md](./PHASE_FINAL_ARCHITECTURE_AUDIT.md)

## Rendering Mermaid Diagrams

- **VS Code / Cursor:** Install "Markdown Preview Mermaid Support" extension
- **GitHub:** Native Mermaid rendering in `.md` files
- **CLI:** `npx @mermaid-js/mermaid-cli -i diagram.md -o diagram.svg`
