'use strict';

const { createLogger } = require('./logger');
const { createNestLogger } = require('./nest-logger');
const { createHttpLoggingMiddleware, createHttpLoggingInterceptor } = require('./http-logging');
const { registerPrometheusRoute } = require('./prometheus-metrics');

function overrideNestStaticLogger(nestLogger) {
  try {
    const { Logger } = require('@nestjs/common');
    if (typeof Logger.overrideLogger === 'function') {
      Logger.overrideLogger(nestLogger);
    }
  } catch {
    // @nestjs/common not available in this runtime
  }
}

function createMedicareNestLogger(serviceName) {
  const nestLogger = createNestLogger(serviceName);
  overrideNestStaticLogger(nestLogger);
  return nestLogger;
}

function setupMedicareLogging(app, options) {
  const serviceName = options?.serviceName;
  if (!serviceName) {
    throw new Error('setupMedicareLogging requires serviceName');
  }

  const logger = createLogger(serviceName);
  const skipPaths = options?.skipPaths;
  const nestLogger = options?.nestLogger ?? createMedicareNestLogger(serviceName);

  app.useLogger(nestLogger);
  overrideNestStaticLogger(nestLogger);

  const expressApp = app.getHttpAdapter?.().getInstance?.();
  if (expressApp) {
    if (options?.enableMetrics !== false) {
      registerPrometheusRoute(expressApp, serviceName);
    }
    if (options?.skipHttpMiddleware !== true) {
      expressApp.use(createHttpLoggingMiddleware(serviceName, { skipPaths }));
    }
  }

  if (options?.logStartup !== false) {
    logger.info('Service bootstrap complete', {
      event: 'service_started',
      module: 'bootstrap',
      metadata: {
        node_env: process.env.NODE_ENV ?? 'development',
        environment: require('./runtime-context').resolveEnvironment(),
        port: options?.port,
      },
    });
  }

  return { logger, nestLogger };
}

function logServiceReady(serviceName, port) {
  const logger = createLogger(serviceName);
  logger.info('Service listening', {
    event: 'service_ready',
    module: 'bootstrap',
    metadata: { port },
  });
}

module.exports = { setupMedicareLogging, logServiceReady, createMedicareNestLogger, overrideNestStaticLogger };
