// GatewayController removed - dual proxy architecture fixed
// All routing is now handled by http-proxy-middleware in main.ts
// This eliminates double-routing, double auth validation, and unpredictable behavior
// The main.ts approach with opossum circuit breaker is more production-grade

import { Controller } from '@nestjs/common';

@Controller('api')
export class GatewayController {
  // Controller kept for module structure but all routes are handled by main.ts proxy
  // Health check endpoint handled locally in main.ts
}