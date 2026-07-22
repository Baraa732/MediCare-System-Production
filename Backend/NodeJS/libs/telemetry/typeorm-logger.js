'use strict';

const { createLogger } = require('./logger');

function isProductionLogging() {
  return process.env.NODE_ENV === 'production' || process.env.MEDICARE_ENV === 'production';
}

function redactDbParameters(parameters) {
  if (!isProductionLogging()) {
    return parameters;
  }
  if (!Array.isArray(parameters)) {
    return '[redacted]';
  }
  return parameters.map(() => '[redacted]');
}

function createTypeOrmLogger(serviceName) {
  const logger = createLogger(serviceName);

  return {
    logQuery(query, parameters) {
      if (process.env.LOG_LEVEL === 'DEBUG') {
        logger.debug('Database query', {
          event: 'db_query',
          module: 'typeorm',
          metadata: { query, parameters: redactDbParameters(parameters) },
        });
      }
    },
    logQueryError(error, query, parameters) {
      logger.error('Database query failed', {
        event: 'db_query_failed',
        module: 'typeorm',
        query_name: query?.slice(0, 80),
        err: error instanceof Error ? error : new Error(String(error)),
        error_code: error?.code,
        metadata: { query, parameters: redactDbParameters(parameters) },
      });
    },
    logQuerySlow(time, query, parameters) {
      logger.warn('Slow database query', {
        event: 'db_query_slow',
        module: 'typeorm',
        duration_ms: time,
        query_name: query?.slice(0, 80),
        metadata: { query, parameters: redactDbParameters(parameters) },
      });
    },
    logSchemaBuild(message) {
      logger.info(String(message), { event: 'db_schema', module: 'typeorm' });
    },
    logMigration(message) {
      logger.info(String(message), { event: 'db_migration', module: 'typeorm' });
    },
    log(level, message) {
      const normalized = String(level).toLowerCase();
      if (normalized.includes('error')) {
        logger.error(String(message), { event: 'db_log', module: 'typeorm' });
      } else if (normalized.includes('warn')) {
        logger.warn(String(message), { event: 'db_log', module: 'typeorm' });
      } else if (process.env.LOG_LEVEL === 'DEBUG') {
        logger.debug(String(message), { event: 'db_log', module: 'typeorm' });
      }
    },
  };
}

function medicareTypeOrmExtras(serviceName) {
  return {
    logger: createTypeOrmLogger(serviceName),
    maxQueryExecutionTime: Number(process.env.DB_SLOW_QUERY_MS ?? 500),
  };
}

module.exports = { createTypeOrmLogger, medicareTypeOrmExtras };
