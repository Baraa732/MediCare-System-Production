'use strict';

const { createLogger } = require('./logger');
const { getRequestContext } = require('./request-context');

function extractModule(exception) {
  if (exception && typeof exception === 'object') {
    if (exception.name === 'QueryFailedError') return 'typeorm';
    if (exception.constructor?.name) return exception.constructor.name;
  }
  return 'http';
}

function logStructuredException(serviceName, input) {
  const logger = createLogger(serviceName);
  const {
    exception,
    request,
    status,
    module,
    event = status >= 500 ? 'request_error' : 'exception',
  } = input;

  const reqCtx = getRequestContext();
  const err = exception instanceof Error ? exception : null;
  const endpoint = request?.url ?? request?.originalUrl ?? reqCtx.endpoint;
  const method = request?.method ?? reqCtx.method;
  const requestId = request?.headers?.['x-request-id'] ?? reqCtx.request_id;

  const payload = {
    event,
    module: module ?? extractModule(exception),
    endpoint: typeof endpoint === 'string' ? endpoint.split('?')[0] : endpoint,
    method,
    status_code: status,
    request_id: requestId ? String(requestId) : undefined,
    user_id: request?.headers?.['x-user-id'] ? String(request.headers['x-user-id']) : reqCtx.user_id,
    tenant_id: request?.headers?.['x-tenant-id'] ? String(request.headers['x-tenant-id']) : reqCtx.tenant_id,
    err,
    error: err?.message ?? String(exception),
    stack: err?.stack,
    metadata: input.metadata,
  };

  if (status >= 500) {
    logger.error(err?.message ?? 'Unhandled exception', payload);
  } else {
    logger.warn(err?.message ?? 'Request exception', payload);
  }

  return payload;
}

module.exports = { logStructuredException, extractModule };
