# Auth

Identity and access control for the MediCare platform.

**Implementation:** `Backend/NodeJS/microservices/auth-service/` (:3001)

| Capability | Details |
|------------|---------|
| Phone registration + OTP | WhatsApp via Evolution API (`Integrations/WhatsApp/client/`) |
| Password login | bcrypt + account lockout |
| MFA | TOTP support |
| Sessions | JWT access + refresh tokens |
| Rate limiting | Redis-backed |

**Public API:** `http://localhost:3000/api/auth/*` (via api-gateway)

**Roles:** SYSTEM_MANAGER, CLINIC_ADMIN, DOCTOR, PATIENT, SECRETARY (defined in user-service)

No separate third-party auth provider (Clerk, Auth0, etc.) — custom NestJS auth-service.
