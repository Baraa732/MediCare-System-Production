'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

let sdkInstance = null;

/**
 * Initialize OpenTelemetry — MUST run before any other application imports.
 * Auto-instruments HTTP, Express, pg, ioredis, net, dns, and outbound calls.
 */
function initTelemetry(serviceName, options = {}) {
  if (sdkInstance) return sdkInstance;
  if (process.env.OTEL_ENABLED === 'false') {
    return null;
  }

  const name = process.env.OTEL_SERVICE_NAME || serviceName;
  const version = process.env.OTEL_SERVICE_VERSION || '1.0.0';
  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318').replace(/\/$/, '');

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const metricExporter = new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` });

  sdkInstance = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: name,
      [ATTR_SERVICE_VERSION]: version,
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: options.metricIntervalMs ?? 15_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || '';
            return url.includes('/health') || url.includes('/metrics');
          },
        },
      }),
    ],
  });

  sdkInstance.start();

  const shutdown = () => {
    sdkInstance?.shutdown().catch(() => undefined);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdkInstance;
}

module.exports = { initTelemetry };
