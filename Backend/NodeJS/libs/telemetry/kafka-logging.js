'use strict';

const { createLogger } = require('./logger');
const { getRequestContext } = require('./request-context');

function logKafkaEventIssue(level, context, message, extra = {}) {
  const serviceName = process.env.SERVICE_NAME ?? process.env.OTEL_SERVICE_NAME ?? 'kafka-consumer';
  const logger = createLogger(serviceName);
  const reqCtx = getRequestContext();
  const payload = {
    event: extra.event ?? 'kafka_event_validation_failed',
    module: context,
    error: message,
    tenant_id: reqCtx.tenant_id,
    request_id: reqCtx.request_id,
    retryable: false,
    ...extra,
  };

  if (level === 'warn') {
    logger.warn(message, payload);
  } else {
    logger.error(message, payload);
  }
}

module.exports = { logKafkaEventIssue };
