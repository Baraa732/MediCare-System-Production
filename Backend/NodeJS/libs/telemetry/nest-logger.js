'use strict';

const { createLogger, normalizeLevel } = require('./logger');

const NOISY_CONTEXTS = new Set(['RouterExplorer', 'RoutesResolver', 'InstanceLoader', 'LegacyRouteConverter']);

function shouldSuppress(context, level) {
  const isDebug = process.env.LOG_LEVEL === 'DEBUG';
  if (isDebug) return false;
  // Always suppress route-mapping boot noise — not useful in observability.
  if (NOISY_CONTEXTS.has(context)) return true;
  return false;
}

function createNestLogger(serviceName) {
  const logger = createLogger(serviceName);

  return {
    log(message, context) {
      if (shouldSuppress(context, 'INFO')) return;
      logger.info(String(message), { module: context ?? 'nest' });
    },
    error(message, trace, context) {
      logger.error(String(message), {
        module: context ?? 'nest',
        stack: typeof trace === 'string' ? trace : undefined,
        err: trace instanceof Error ? trace : undefined,
      });
    },
    warn(message, context) {
      if (shouldSuppress(context, 'WARN')) return;
      logger.warn(String(message), { module: context ?? 'nest' });
    },
    debug(message, context) {
      if (shouldSuppress(context, 'DEBUG')) return;
      logger.debug(String(message), { module: context ?? 'nest' });
    },
    verbose(message, context) {
      if (shouldSuppress(context, 'DEBUG')) return;
      logger.debug(String(message), { module: context ?? 'nest' });
    },
    fatal(message, context) {
      logger.critical(String(message), { module: context ?? 'nest' });
    },
    setLogLevels() {},
  };
}

module.exports = { createNestLogger, NOISY_CONTEXTS };
