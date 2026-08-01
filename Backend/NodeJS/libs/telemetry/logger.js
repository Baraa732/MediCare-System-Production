'use strict';

const api = require('@opentelemetry/api');
const { randomUUID } = require('crypto');
const { getRequestContext } = require('./request-context');
const { getRuntimeContext } = require('./runtime-context');
const { parseStackTrace } = require('./stack-parser');
const { classifyErrorClass, classifyBusinessImpact } = require('./log-error-classifier');
const { normalizeLogMessage } = require('./log-message-normalizer');

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
  if (upper === 'WARNING') return 'WARN';
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
    if (!copy.error_code && copy.err.code) copy.error_code = copy.err.code;
    delete copy.err;
  }
  if (copy.error instanceof Error) {
    copy.error_name = copy.error.name;
    copy.stack = copy.stack ?? copy.error.stack;
    copy.error = copy.error.message;
  }
  return copy;
}

function enrichErrorRecord(record, cleaned, normalized) {
  const hasFailureContext = Boolean(
    cleaned.error || cleaned.stack || cleaned.error_code || cleaned.status_code != null || cleaned.event,
  );
  const isErrorLike =
    normalized === 'ERROR' ||
    normalized === 'CRITICAL' ||
    (normalized === 'WARN' && hasFailureContext);

  if (!isErrorLike) return;

  if (!cleaned.error_class) {
    record.error_class = classifyErrorClass({
      error_code: cleaned.error_code,
      error_name: cleaned.error_name,
      error: cleaned.error,
      event: cleaned.event,
      status_code: cleaned.status_code,
      module: cleaned.module,
    });
  } else {
    record.error_class = cleaned.error_class;
  }

  if (!cleaned.business_impact) {
    record.business_impact = classifyBusinessImpact({
      error_class: record.error_class,
      event: cleaned.event,
      module: cleaned.module,
      status_code: cleaned.status_code,
      level: normalized,
    });
  } else {
    record.business_impact = cleaned.business_impact;
  }

  if (cleaned.stack) {
    const parsed = parseStackTrace(cleaned.stack, cleaned.error);
    record.stack_summary = parsed.stack_summary;
    record.stack_frames = parsed.stack_frames;
    if (process.env.LOG_INCLUDE_RAW_STACK === 'true') {
      record.raw_stack = parsed.raw_stack;
    }
  }
}

function emit(serviceName, level, message, extra = {}) {
  const ctx = activeTraceContext();
  const reqCtx = getRequestContext();
  const normalized = normalizeLevel(level);
  const cleaned = sanitizeExtra(extra);
  const runtime = getRuntimeContext(serviceName);
  const normalizedMessage = normalizeLogMessage(message, cleaned);

  const record = {
    timestamp: new Date().toISOString(),
    environment: runtime.environment,
    host: runtime.host,
    level: normalized,
    service: serviceName,
    message: normalizedMessage.message,
    trace_id: cleaned.trace_id ?? cleaned.traceId ?? reqCtx.trace_id ?? ctx.trace_id ?? null,
    span_id: cleaned.span_id ?? cleaned.spanId ?? reqCtx.span_id ?? ctx.span_id ?? null,
    request_id: cleaned.request_id ?? cleaned.requestId ?? cleaned.correlation_id ?? reqCtx.request_id ?? null,
  };

  if (normalizedMessage.detail) record.detail = normalizedMessage.detail;
  if (normalizedMessage.context) record.context = normalizedMessage.context;
  if (normalizedMessage.raw_message) record.raw_message = normalizedMessage.raw_message;

  if (runtime.container_id) record.container_id = runtime.container_id;
  if (runtime.pod_name) record.pod_name = runtime.pod_name;
  if (runtime.instance_id) record.instance_id = runtime.instance_id;

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

  if (cleaned.retry_count != null) record.retry_count = cleaned.retry_count;
  if (cleaned.max_retries != null) record.max_retries = cleaned.max_retries;
  if (cleaned.retryable != null) record.retryable = cleaned.retryable;

  enrichErrorRecord(record, cleaned, normalized);

  const metadata = cleaned.metadata ?? cleaned.meta;
  const mergedMetadata = {
    ...(normalizedMessage.metadata && typeof normalizedMessage.metadata === 'object' ? normalizedMessage.metadata : {}),
    ...(metadata && typeof metadata === 'object' ? metadata : {}),
  };
  if (Object.keys(mergedMetadata).length) {
    record.metadata = mergedMetadata;
  }

  const reserved = new Set([
    'traceId', 'spanId', 'requestId', 'correlation_id', 'meta', 'metadata',
    'err', 'error_name', 'stack', 'error_class', 'business_impact',
  ]);

  for (const [key, value] of Object.entries(cleaned)) {
    if (record[key] !== undefined) continue;
    if (reserved.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue;
    record[key] = value;
  }

  const line = JSON.stringify(record);
  if (normalized === 'ERROR' || normalized === 'CRITICAL' || normalized === 'WARN') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }

  try {
    const { enqueue } = require('./loki-push');
    enqueue(serviceName, line);
  } catch {
    // Loki push is optional; never break logging.
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
