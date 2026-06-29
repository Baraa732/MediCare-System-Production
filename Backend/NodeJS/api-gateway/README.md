# API Gateway - MediCare Clinic Management System

Central API Gateway for all microservices in the MediCare Clinic Management System.

## Features

- **Single Entry Point**: All API requests go through the gateway
- **Request Routing**: Routes requests to appropriate microservices
- **Authentication**: Centralized JWT token validation
- **CORS Management**: Centralized CORS configuration
- **Rate Limiting**: Global rate limiting
- **Health Checks**: Gateway and service health monitoring
- **Swagger Documentation**: Auto-generated API documentation
- **Error Handling**: Consistent error responses
- **Logging**: Centralized request/response logging

## Architecture

```
Client → API Gateway (port 3000) → Microservices
                    ↓
            Auth Service (3001)
            User Service (3002)
            System Manager Service (3003)
```

## API Endpoints

All endpoints are prefixed with `/api`

### Authentication Service (`/api/auth/*`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/sessions` - Get user sessions
- `POST /api/auth/clinic-admin/activate` - Activate clinic admin

### User Service (`/api/users/*`, `/api/account-linking/*`)
- `POST /api/users` - Create user
- `GET /api/users` - Get users (paginated)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/account-linking/link-patient` - Link patient account
- `GET /api/account-linking/linked` - Get linked accounts
- `DELETE /api/account-linking/unlink/:userId` - Unlink account

### System Manager Service (`/api/system-manager/*`)
- `POST /api/system-manager/login` - System manager login
- `POST /api/system-manager/create` - Create system manager
- `POST /api/system-manager/create-clinic-admin` - Create clinic admin
- `POST /api/system-manager/activation-code/generate` - Generate activation code
- `POST /api/system-manager/activation-code/revoke` - Revoke activation code
- `GET /api/system-manager/activation-code/status` - Get activation code status

### Health Checks
- `GET /api/health` - Gateway health
- `GET /api/health/auth` - Auth service health
- `GET /api/health/user` - User service health
- `GET /api/health/system-manager` - System manager service health

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# API Gateway Configuration
PORT=3000
NODE_ENV=development

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
SYSTEM_MANAGER_SERVICE_URL=http://localhost:3003

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Development

### Prerequisites
- Node.js 18+
- Docker and Docker Compose

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the gateway:
   ```bash
   npm run start:dev
   ```

3. Access Swagger documentation:
   ```
   http://localhost:3000/api-docs
   ```

### Docker Development

1. Build and start all services:
   ```bash
   docker-compose up --build
   ```

2. Access the gateway:
   ```
   http://localhost:3000
   ```

## Security

### Authentication
- JWT tokens are validated with the auth service
- Public routes don't require authentication
- Tokens are passed via `Authorization: Bearer <token>` header

### CORS
- Configurable allowed origins
- Pre-flight requests handled
- Credentials supported

### Rate Limiting
- Global rate limiting per IP
- Configurable window and limits
- HTTP 429 responses for exceeded limits

## Monitoring

### Health Checks
- Gateway health: `GET /api/health`
- Service health: Individual service endpoints
- Docker health checks configured

### Logging
- Request/response logging
- Error logging with stack traces
- Structured JSON logs in production

## API Documentation

Swagger documentation is available at `/api-docs` when `NODE_ENV=development`.

## Troubleshooting

### Common Issues

1. **Gateway can't connect to services**
   - Check service URLs in `.env`
   - Verify services are running
   - Check network connectivity

2. **CORS errors**
   - Update `ALLOWED_ORIGINS` in `.env`
   - Check browser console for details

3. **Authentication failures**
   - Verify JWT token format
   - Check auth service health
   - Validate token expiration

### Logs
Check Docker logs:
```bash
docker logs api_gateway
```

Or application logs in `/var/log/api-gateway/` (if configured).

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Use meaningful commit messages

## License

Proprietary - MediCare Clinic Management System