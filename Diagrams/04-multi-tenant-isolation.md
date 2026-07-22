# Multi-Tenant Isolation Diagram

```mermaid
flowchart TB
    subgraph TenantA["Tenant A — Clinic UUID-A"]
        TA_REQ[Request JWT tenantId=A]
        TA_CTX[TenantContext ALS<br/>tenantId=A]
        TA_DB_A[(appointment_db<br/>WHERE tenant_id=A)]
        TA_DB_C[(clinic_db<br/>tenants + staff_assignments)]
        TA_KAFKA[Kafka envelope<br/>tenantId=A]
    end

    subgraph TenantB["Tenant B — Clinic UUID-B"]
        TB_REQ[Request JWT tenantId=B]
        TB_CTX[TenantContext ALS<br/>tenantId=B]
        TB_DB_A[(appointment_db<br/>WHERE tenant_id=B)]
        TB_DB_C[(clinic_db<br/>tenants + staff_assignments)]
        TB_KAFKA[Kafka envelope<br/>tenantId=B]
    end

    subgraph EnforcementLayers["Isolation Enforcement Layers"]
        L1[Gateway: strip forged x-tenant-id]
        L2[TenantMiddleware: resolve from JWT]
        L3[TenantGuard: require tenant context]
        L4[TenantAuthorizationGuard:<br/>assertStaffAccess / assertPatientAccess]
        L5[Query scoping: tenantFindWhere]
        L6[Kafka: signed envelope + corroboration HTTP]
        L7[Internal HTTP: HMAC + route allowlist]
    end

    subgraph SharedInfra["Shared Infrastructure — Logical Isolation Only"]
        PG[(PostgreSQL instances<br/>shared schema + tenant_id)]
        REDIS[(Redis<br/>tenant-prefixed keys)]
        OE[OpenEMR single instance<br/>logical patient links per tenant]
    end

    TA_REQ --> L1 --> L2 --> L3 --> L4 --> L5
    TB_REQ --> L1 --> L2 --> L3 --> L4 --> L5

    L5 --> TA_DB_A & TA_DB_C
    L5 --> TB_DB_A & TB_DB_C

    L6 --> TA_KAFKA & TB_KAFKA
    L7 --> TA_CTX & TB_CTX

    TA_DB_A & TB_DB_A --> PG
    TA_KAFKA & TB_KAFKA --> PG
    L1 --> REDIS
    EMR_LINK[emr_db patient_emr_links] --> OE
```

## Tenant Resolution Priority (Staff)

```mermaid
flowchart LR
    JWT[JWT tenantId] --> CLINIC[JWT clinicId]
    CLINIC --> HDR[X-Tenant-ID from gateway]
    HDR --> BODY[query/body clinicId]
    BODY --> SUB[subdomain slug — future]
```

## Patient Role Exception

Patients **ignore** JWT/header tenant claims; only `body.clinicId` / `query.clinicId` is trusted, then `assertPatientAccess` verifies relation.
