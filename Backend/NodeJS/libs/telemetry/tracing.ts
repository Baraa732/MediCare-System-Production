/**
 * Copy or symlink this file as src/tracing.ts in each microservice.
 * Import as the FIRST line in main.ts: import './tracing';
 */
import { initTelemetry } from '@medicare/telemetry';

initTelemetry(process.env.OTEL_SERVICE_NAME || 'unknown-service');
