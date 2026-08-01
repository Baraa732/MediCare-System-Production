'use strict';

const { initTelemetry } = require('./otel');
const { createLogger, emit, normalizeLevel } = require('./logger');
const { createNestLogger } = require('./nest-logger');
const { createHttpLoggingMiddleware, createHttpLoggingInterceptor } = require('./http-logging');
const { logStructuredException } = require('./exception-logging');
const { logKafkaEventIssue } = require('./kafka-logging');
const { classifyErrorClass, classifyBusinessImpact, ERROR_CLASSES, BUSINESS_IMPACT } = require('./log-error-classifier');
const { parseStackTrace } = require('./stack-parser');
const { getRuntimeContext, resolveEnvironment } = require('./runtime-context');
const { createTypeOrmLogger, medicareTypeOrmExtras } = require('./typeorm-logger');
const { instrumentRedisClient, wrapRedisCommand, instrumentIoredisClient } = require('./redis-instrumentation');
const { setupMedicareLogging, logServiceReady, createMedicareNestLogger, overrideNestStaticLogger } = require('./setup-logging');
const { registerPrometheusRoute } = require('./prometheus-metrics');
const { getRequestContext, mergeRequestContext, runWithRequestContext } = require('./request-context');
const { isRailwayRuntime, resolveLokiBaseUrl, resolveLokiPushUrl } = require('./loki-url');

module.exports = {
  initTelemetry,
  createLogger,
  emit,
  normalizeLevel,
  createNestLogger,
  createHttpLoggingMiddleware,
  createHttpLoggingInterceptor,
  logStructuredException,
  logKafkaEventIssue,
  classifyErrorClass,
  classifyBusinessImpact,
  ERROR_CLASSES,
  BUSINESS_IMPACT,
  parseStackTrace,
  getRuntimeContext,
  resolveEnvironment,
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
  registerPrometheusRoute,
  isRailwayRuntime,
  resolveLokiBaseUrl,
  resolveLokiPushUrl,
};
