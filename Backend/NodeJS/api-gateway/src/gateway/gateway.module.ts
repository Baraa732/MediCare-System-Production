import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtCacheService } from './services/jwt-cache.service';

// Routing is handled by http-proxy-middleware registered directly in main.ts.
// GatewayController and GatewayService are no longer needed for proxying —
// they have been replaced by the dynamic SERVICE_ROUTES proxy in main.ts.
// This module exists to keep the NestJS module graph valid and to provide
// a home for any future gateway-level providers (e.g. metrics, rate limiting).
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [JwtCacheService],
  exports: [JwtCacheService],
})
export class GatewayModule {}
