'use strict';

const api = require('@opentelemetry/api');
const { randomUUID } = require('crypto');
const { getRequestContext } = require('./request-context');

const LEVELS = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL']);

function activeTraceContext() {
  const span = api.trace.getActiveSpan();
  const ctx = span?.spanContext();
  return {
    trace_id: ctx?.traceId && ctx.traceId !== '00000000000000000000000000000000' ? ctx.traceId : null,
    span_id: ctx?.spanId && ctx.spanId !== '0000000000000000' ? ctx.spanId : null,
  };
}

function normalizeLevel(level) {
  const upper = String(level ?? 'INFO').toUpperCase();
  if (upper === 'FATAL') return 'CRITICAL';
  if (upper === 'LOG') return 'INFO';
  if (LEVELS.has(upper)) return upper;
  return 'INFO';
}

function sanitizeExtra(extra) {
  if (!extra || typeof extra !== 'object') return {};
  const copy = { ...extra };
  if (copy.err instanceof Error) {
    copy.error = copy.err.message;
    copy.stack = copy.err.stack;
    copy.error_name = copy.err.name;
    delete copy.err;
  }
  if (copy.error instanceof Error) {
    copy.error = copy.error.message;
    copy.stack = copy.stack ?? copy.error.stack;
  }
  return copy;
}

function emit(serviceName, level, message, extra = {}) {
  const ctx = activeTraceContext();
  const reqCtx = getRequestContext();
  const normalized = normalizeLevel(level);
  const cleaned = sanitizeExtra(extra);

  const record = {
    timestamp: new Date().toISOString(),
    level: normalized,
    service: serviceName,
    message: String(message ?? ''),
    trace_id: cleaned.trace_id ?? cleaned.traceId ?? reqCtx.trace_id ?? ctx.trace_id ?? null,
    span_id: cleaned.span_id ?? cleaned.spanId ?? reqCtx.span_id ?? ctx.span_id ?? null,
    request_id: cleaned.request_id ?? cleaned.requestId ?? cleaned.correlation_id ?? reqCtx.request_id ?? null,
  };

  if (cleaned.event) record.event = cleaned.event;
  if (cleaned.module) record.module = cleaned.module;
  if (cleaned.endpoint ?? reqCtx.endpoint) record.endpoint = cleaned.endpoint ?? reqCtx.endpoint;
  if (cleaned.method ?? reqCtx.method) record.method = cleaned.method ?? reqCtx.method;
  if (cleaned.status_code != null) record.status_code = cleaned.status_code;
  if (cleaned.duration_ms != null) record.duration_ms = cleaned.duration_ms;
  if (cleaned.user_id ?? reqCtx.user_id) record.user_id = cleaned.user_id ?? reqCtx.user_id;
  if (cleaned.tenant_id ?? reqCtx.tenant_id) record.tenant_id = cleaned.tenant_id ?? reqCtx.tenant_id;
  if (cleaned.query_name) record.query_name = cleaned.query_name;
  if (cleaned.error_code) record.error_code = cleaned.error_code;
  if (cleaned.error ?? cleaned.error_name) record.error = cleaned.error ?? cleaned.error_name;
  if (cleaned.stack) record.stack = cleaned.stack;

  const metadata = cleaned.metadata ?? cleaned.meta;
  if (metadata && typeof metadata === 'object') {
    record.metadata = metadata;
  }

  for (const [key, value] of Object.entries(cleaned)) {
    if (record[key] !== undefined) continue;
    if (['traceId', 'spanId', 'requestId', 'correlation_id', 'meta'].includes(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue;
    record[key] = value;
  }

  const line = JSON.stringify(record);
  if (normalized === 'ERROR' || normalized === 'CRITICAL') {
    process.stderr.write(`${line}\n`);
  } else if (normalized === 'WARN') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
  return record;
}

function createLogger(serviceName) {
  return {
    debug: (message, extra) => emit(serviceName, 'DEBUG', message, extra),
    info: (message, extra) => emit(serviceName, 'INFO', message, extra),
    warn: (message, extra) => emit(serviceName, 'WARN', message, extra),
    error: (message, extra) => emit(serviceName, 'ERROR', message, extra),
    critical: (message, extra) => emit(serviceName, 'CRITICAL', message, extra),
    log: (level, message, extra) => emit(serviceName, level, message, extra),
    child: () => createLogger(serviceName),
    requestId: () => randomUUID(),
  };
}

module.exports = { createLogger, emit, normalizeLevel };
