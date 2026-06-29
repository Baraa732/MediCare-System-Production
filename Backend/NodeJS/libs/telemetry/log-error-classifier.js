'use strict';

const ERROR_CLASSES = Object.freeze({
  DATABASE_SCHEMA_ERROR: 'DATABASE_SCHEMA_ERROR',
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  REDIS_TIMEOUT: 'REDIS_TIMEOUT',
  HTTP_TIMEOUT: 'HTTP_TIMEOUT',
  AUTH_FAILURE: 'AUTH_FAILURE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN: 'UNKNOWN',
});

const BUSINESS_IMPACT = Object.freeze({
  NONE: 'NONE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const PG_SCHEMA_CODES = new Set(['42P01', '42P07', '42703', '3F000', '3D000']);
const PG_CONNECTION_CODES = new Set(['08000', '08001', '08003', '08006', '08004', '57P01', '57P03', '53300']);

function classifyErrorClass(input = {}) {
  const {
    error_code: errorCode,
    error_name: errorName,
    error,
    event,
    status_code: statusCode,
    module,
  } = input;

  const code = String(errorCode ?? '').toUpperCase();
  const name = String(errorName ?? '').toLowerCase();
  const message = String(error ?? '').toLowerCase();
  const evt = String(event ?? '').toLowerCase();
  const mod = String(module ?? '').toLowerCase();

  if (statusCode === 401 || statusCode === 403 || evt.includes('auth') || mod.includes('auth')) {
    return ERROR_CLASSES.AUTH_FAILURE;
  }
  if (statusCode === 429 || evt.includes('rate_limit')) {
    return ERROR_CLASSES.RATE_LIMIT_EXCEEDED;
  }
  if (
    statusCode === 400 ||
    statusCode === 422 ||
    name.includes('validation') ||
    name.includes('badrequest') ||
    evt.includes('validation')
  ) {
    return ERROR_CLASSES.VALIDATION_ERROR;
  }

  if (PG_SCHEMA_CODES.has(code) || /relation .* does not exist|undefined column|undefined table/i.test(message)) {
    return ERROR_CLASSES.DATABASE_SCHEMA_ERROR;
  }
  if (
    PG_CONNECTION_CODES.has(code) ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    /connection terminated|could not connect|connection refused/i.test(message)
  ) {
    if (mod.includes('redis') || evt.includes('redis')) {
      return ERROR_CLASSES.REDIS_TIMEOUT;
    }
    return ERROR_CLASSES.DATABASE_CONNECTION_ERROR;
  }

  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'ESOCKETTIMEDOUT' ||
    evt.includes('timeout') ||
    evt.includes('slow')
  ) {
    if (mod.includes('redis') || evt.includes('redis')) {
      return ERROR_CLASSES.REDIS_TIMEOUT;
    }
    if (evt.includes('http') || evt.includes('request')) {
      return ERROR_CLASSES.HTTP_TIMEOUT;
    }
    return ERROR_CLASSES.REDIS_TIMEOUT;
  }

  if (evt.includes('redis')) {
    return ERROR_CLASSES.REDIS_TIMEOUT;
  }
  if (evt.includes('db_') || mod.includes('typeorm') || mod.includes('platformstats')) {
    return ERROR_CLASSES.DATABASE_CONNECTION_ERROR;
  }

  return ERROR_CLASSES.UNKNOWN;
}

function classifyBusinessImpact(input = {}) {
  const {
    error_class: errorClass,
    event,
    module,
    status_code: statusCode,
    level,
  } = input;

  const evt = String(event ?? '').toLowerCase();
  const mod = String(module ?? '').toLowerCase();
  const normalizedLevel = String(level ?? '').toUpperCase();

  if (normalizedLevel === 'INFO' || normalizedLevel === 'DEBUG') {
    return BUSINESS_IMPACT.NONE;
  }

  if (errorClass === ERROR_CLASSES.AUTH_FAILURE || statusCode === 401 || statusCode === 403) {
    return BUSINESS_IMPACT.HIGH;
  }
  if (errorClass === ERROR_CLASSES.RATE_LIMIT_EXCEEDED) {
    return BUSINESS_IMPACT.MEDIUM;
  }
  if (evt.includes('billing') || evt.includes('payment') || mod.includes('billing')) {
    return BUSINESS_IMPACT.CRITICAL;
  }
  if (evt.includes('notification') || mod.includes('notification') || mod.includes('whatsapp')) {
    return BUSINESS_IMPACT.MEDIUM;
  }
  if (evt.includes('redis_reconnect') || evt.includes('redis_connect_failed')) {
    return BUSINESS_IMPACT.MEDIUM;
  }
  if (evt.includes('db_query_failed') && (mod.includes('platformstats') || evt.includes('stats'))) {
    return BUSINESS_IMPACT.LOW;
  }
  if (errorClass === ERROR_CLASSES.DATABASE_SCHEMA_ERROR) {
    return BUSINESS_IMPACT.LOW;
  }
  if (errorClass === ERROR_CLASSES.DATABASE_CONNECTION_ERROR) {
    return BUSINESS_IMPACT.HIGH;
  }
  if (normalizedLevel === 'CRITICAL') {
    return BUSINESS_IMPACT.CRITICAL;
  }
  if (statusCode != null && statusCode >= 500) {
    return BUSINESS_IMPACT.HIGH;
  }
  if (normalizedLevel === 'WARN') {
    return BUSINESS_IMPACT.LOW;
  }
  if (normalizedLevel === 'ERROR') {
    return BUSINESS_IMPACT.MEDIUM;
  }

  return BUSINESS_IMPACT.LOW;
}

module.exports = {
  ERROR_CLASSES,
  BUSINESS_IMPACT,
  classifyErrorClass,
  classifyBusinessImpact,
};
