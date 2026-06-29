'use strict';

const { initTelemetry } = require('./otel');
const { createLogger, emit, normalizeLevel } = require('./logger');
const { createNestLogger } = require('./nest-logger');
const { createHttpLoggingMiddleware, createHttpLoggingInterceptor } = require('./http-logging');
const { logStructuredException } = require('./exception-logging');
const { createTypeOrmLogger, medicareTypeOrmExtras } = require('./typeorm-logger');
const { instrumentRedisClient, wrapRedisCommand, instrumentIoredisClient } = require('./redis-instrumentation');
const { setupMedicareLogging, logServiceReady, createMedicareNestLogger, overrideNestStaticLogger } = require('./setup-logging');
const { getRequestContext, mergeRequestContext, runWithRequestContext } = require('./request-context');

module.exports = {
  initTelemetry,
  createLogger,
  emit,
  normalizeLevel,
  createNestLogger,
  createHttpLoggingMiddleware,
  createHttpLoggingInterceptor,
  logStructuredException,
  createTypeOrmLogger,
  medicareTypeOrmExtras,
  instrumentRedisClient,
  wrapRedisCommand,
  instrumentIoredisClient,
  setupMedicareLogging,
  logServiceReady,
  createMedicareNestLogger,
  overrideNestStaticLogger,
  getRequestContext,
  mergeRequestContext,
  runWithRequestContext,
};
