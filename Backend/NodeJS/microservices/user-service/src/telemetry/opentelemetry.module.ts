import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Fix 30: OpenTelemetry distributed tracing module.
 * Configures distributed tracing with Jaeger exporter.
 */
@Module({
  imports: [ConfigModule],
  providers: [],
  exports: [],
})
export class OpenTelemetryModule {
  static register() {
    // OpenTelemetry initialization is done in main.ts before NestJS bootstrap
    // This module is for future extension with custom instrumentation
    return {
      module: OpenTelemetryModule,
      global: true,
    };
  }
}
