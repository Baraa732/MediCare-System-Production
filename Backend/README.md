# Backend

NestJS microservices and API gateway.

| Service | Path | Port |
|---------|------|------|
| API Gateway | `NodeJS/api-gateway/` | 3000 |
| Auth | `NodeJS/microservices/auth-service/` | 3001 |
| Users | `NodeJS/microservices/user-service/` | 3002 |
| System Manager | `NodeJS/microservices/system-manager-service/` | 3003 |

OpenEMR integration: `Integrations/OpenEMR/emr-service/` (:3004)

Stack: Node.js, NestJS, TypeORM, KafkaJS, Express (gateway proxy).
