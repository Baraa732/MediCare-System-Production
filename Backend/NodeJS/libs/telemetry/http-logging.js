'use strict';

const { randomUUID } = require('crypto');
const { createLogger } = require('./logger');
const { runWithRequestContext, mergeRequestContext } = require('./request-context');
const { recordHttpResponse } = require('./prometheus-metrics');

const DEFAULT_SKIP = new Set([
  '/health',
  '/health/live',
  '/health/ready',
  '/metrics',
]);

function normalizePath(url) {
  const raw = String(url ?? '/').split('?')[0];
  if (!raw) return '/';
  return raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function shouldSkip(path, method, skipPaths) {
  if (method === 'OPTIONS') return true;
  const skip = skipPaths instanceof Set ? skipPaths : new Set(skipPaths ?? []);
  for (const item of DEFAULT_SKIP) skip.add(item);
  return skip.has(path);
}

function isExpectedClientError(path, statusCode) {
  if (statusCode === 401 && path === '/api/system-manager/platform/stream') return true;
  return false;
}

function extractUserContext(req) {
  return {
    user_id: req.headers['x-user-id'] ? String(req.headers['x-user-id']) : undefined,
    tenant_id: req.headers['x-tenant-id'] ? String(req.headers['x-tenant-id']) : undefined,
  };
}

function createHttpLoggingMiddleware(serviceName, options = {}) {
  const logger = createLogger(serviceName);
  const skipPaths = options.skipPaths;

  return function medicareHttpLoggingMiddleware(req, res, next) {
    const path = normalizePath(req.originalUrl || req.url);
    if (shouldSkip(path, req.method, skipPaths)) {
      return next();
    }

    const requestId = String(req.headers['x-request-id'] || randomUUID());
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    const started = Date.now();
    const userCtx = extractUserContext(req);
    const baseContext = {
      request_id: requestId,
      method: req.method,
      endpoint: path,
      ...userCtx,
    };

    runWithRequestContext(baseContext, () => {
      logger.info('Request started', {
        event: 'request_start',
        method: req.method,
        endpoint: path,
        request_id: requestId,
        ...userCtx,
      });

      res.on('finish', () => {
        const duration_ms = Date.now() - started;
        const status_code = res.statusCode;
        recordHttpResponse(serviceName, status_code, duration_ms, req.method);
        const payload = {
          event: status_code >= 400 ? 'request_error' : 'request_end',
          method: req.method,
          endpoint: path,
          status_code,
          duration_ms,
          request_id: requestId,
          ...userCtx,
        };

        if (status_code >= 500) {
          logger.error('Request failed', payload);
        } else if (status_code >= 400 && !isExpectedClientError(path, status_code)) {
          logger.warn('Request completed with client error', payload);
        } else if (duration_ms >= 2000) {
          logger.warn('Slow request completed', { ...payload, event: 'request_slow' });
        } else {
          logger.info('Request completed', payload);
        }
      });

      next();
    });
  };
}

function createHttpLoggingInterceptor(serviceName, options = {}) {
  const logger = createLogger(serviceName);
  const skipPaths = options.skipPaths;

  class HttpLoggingInterceptor {
    intercept(context, next) {
      const http = context.switchToHttp();
      const req = http.getRequest();
      const res = http.getResponse();
      if (!req || !res) {
        return next.handle();
      }

      const path = normalizePath(req.originalUrl || req.url);
      if (shouldSkip(path, req.method, skipPaths)) {
        return next.handle();
      }

      const requestId = String(req.headers['x-request-id'] || randomUUID());
      req.headers['x-request-id'] = requestId;
      res.setHeader('x-request-id', requestId);

      const started = Date.now();
      const userCtx = extractUserContext(req);
      mergeRequestContext({
        request_id: requestId,
        method: req.method,
        endpoint: path,
        ...userCtx,
      });

      logger.info('Request started', {
        event: 'request_start',
        method: req.method,
        endpoint: path,
        request_id: requestId,
        ...userCtx,
      });

      return next.handle();
    }
  }

  HttpLoggingInterceptor.prototype.__medicareService = serviceName;
  return HttpLoggingInterceptor;
}

module.exports = {
  createHttpLoggingMiddleware,
  createHttpLoggingInterceptor,
  shouldSkip,
  normalizePath,
  isExpectedClientError,
};
