'use strict';

const { createLogger } = require('./logger');

function instrumentRedisClient(client, serviceName, label = 'redis') {
  if (!client) return client;
  const logger = createLogger(serviceName);

  client.on?.('error', (err) => {
    logger.error('Redis client error', {
      event: 'redis_error',
      module: label,
      err,
      error_code: err?.code,
    });
  });

  client.on?.('reconnecting', () => {
    logger.warn('Redis reconnecting', { event: 'redis_reconnect', module: label });
  });

  client.on?.('ready', () => {
    logger.info('Redis ready', { event: 'redis_ready', module: label });
  });

  client.on?.('end', () => {
    logger.warn('Redis connection ended', { event: 'redis_end', module: label });
  });

  const originalConnect = client.connect?.bind(client);
  if (originalConnect) {
    client.connect = async (...args) => {
      const started = Date.now();
      try {
        const result = await originalConnect(...args);
        logger.info('Redis connected', {
          event: 'redis_connect',
          module: label,
          duration_ms: Date.now() - started,
        });
        return result;
      } catch (err) {
        logger.error('Redis connect failed', {
          event: 'redis_connect_failed',
          module: label,
          duration_ms: Date.now() - started,
          err,
          error_code: err?.code,
        });
        throw err;
      }
    };
  }

  return client;
}

function wrapRedisCommand(client, serviceName, label = 'redis') {
  if (!client || typeof client.sendCommand !== 'function') return client;
  const logger = createLogger(serviceName);
  const original = client.sendCommand.bind(client);

  client.sendCommand = async (...args) => {
    const started = Date.now();
    try {
      const result = await original(...args);
      const duration_ms = Date.now() - started;
      if (duration_ms >= Number(process.env.REDIS_SLOW_MS ?? 2500)) {
        logger.warn('Redis command slow', {
          event: 'redis_timeout',
          module: label,
          duration_ms,
          metadata: { command: args[0]?.args?.[0] },
        });
      }
      return result;
    } catch (err) {
      logger.error('Redis command failed', {
        event: 'redis_command_failed',
        module: label,
        duration_ms: Date.now() - started,
        err,
        error_code: err?.code,
      });
      throw err;
    }
  };

  return client;
}

function instrumentIoredisClient(client, serviceName, label = 'redis') {
  if (!client?.on) return client;
  const logger = createLogger(serviceName);

  client.on('error', (err) => {
    logger.error('Redis client error', {
      event: 'redis_error',
      module: label,
      err,
      error_code: err?.code,
    });
  });

  client.on('reconnecting', () => {
    logger.warn('Redis reconnecting', { event: 'redis_reconnect', module: label });
  });

  client.on('connect', () => {
    logger.info('Redis connected', { event: 'redis_connect', module: label });
  });

  client.on('close', () => {
    logger.warn('Redis connection closed', { event: 'redis_end', module: label });
  });

  return client;
}

module.exports = { instrumentRedisClient, wrapRedisCommand, instrumentIoredisClient };
