'use strict';

function tryParseJson(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (
    !(trimmed.startsWith('{') && trimmed.endsWith('}')) &&
    !(trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readString(obj, ...keys) {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

function readNumber(obj, ...keys) {
  for (const key of keys) {
    const val = obj[key];
    const num = typeof val === 'number' ? val : Number(val);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

function truncate(value, max) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

/** Split Nest/Kafka style: `ERROR [Context] text {json}` */
function splitNestStyleLine(raw) {
  const trimmed = String(raw ?? '').trim();
  const nest = trimmed.match(/^(?:ERROR|WARN|INFO|DEBUG|TRACE|CRITICAL|FATAL)\s+\[([^\]]+)\]\s+(.+)$/i);
  if (!nest) {
    const jsonOnly = tryParseJson(trimmed);
    if (jsonOnly && asRecord(jsonOnly)) {
      return { context: null, text: '', json: asRecord(jsonOnly) };
    }
    const jsonTail = trimmed.match(/^(.+?)\s+(\{[\s\S]+\})\s*$/);
    if (jsonTail) {
      return {
        context: null,
        text: jsonTail[1].trim(),
        json: asRecord(tryParseJson(jsonTail[2])),
      };
    }
    return { context: null, text: trimmed, json: null };
  }

  let rest = nest[2].trim();
  let json = null;
  const jsonTail = rest.match(/^(.+?)\s+(\{[\s\S]+\})\s*$/);
  if (jsonTail) {
    rest = jsonTail[1].trim();
    json = asRecord(tryParseJson(jsonTail[2]));
  }

  return { context: nest[1], text: rest, json };
}

function formatHttpMessage(extra, text) {
  const method = readString(extra, 'method')?.toUpperCase();
  const path = readString(extra, 'endpoint', 'path', 'url', 'route');
  const status = readNumber(extra, 'status_code', 'statusCode', 'status');
  const duration = readNumber(extra, 'duration_ms', 'durationMs', 'duration');
  const lower = String(text ?? '').toLowerCase();

  if (method || path || status != null) {
    const left = [method, path].filter(Boolean).join(' ');
    if (status != null && left) return { message: `${left} → ${status}`, detail: duration != null ? `${duration}ms` : null };
    if (status != null) return { message: `HTTP ${status}`, detail: duration != null ? `${duration}ms` : null };
    if (left) return { message: left, detail: duration != null ? `${duration}ms` : null };
  }

  if (lower.includes('request completed with client error')) {
    return { message: 'Client error response', detail: status != null ? String(status) : readString(extra, 'error') };
  }
  if (lower.includes('request completed')) {
    return { message: 'Request completed', detail: duration != null ? `${duration}ms` : null };
  }
  if (lower.includes('request started')) {
    return { message: 'Request started', detail: path ?? null };
  }
  return null;
}

function formatKafkaMessage(text, json, context) {
  const err = readString(json ?? {}, 'error', 'message', 'msg');
  const groupId = readString(json ?? {}, 'groupId', 'group_id');
  const broker = readString(json ?? {}, 'broker');
  const lower = `${text} ${err ?? ''}`.toLowerCase();

  if (lower.includes('rebalancing') || lower.includes('re-join')) {
    return {
      message: 'Consumer group rebalancing',
      detail: err || 'Kafka is reassigning partitions',
      context: context ?? 'Kafka',
    };
  }
  if (lower.includes('heartbeat') && (lower.includes('rejoin') || lower.includes('rebalancing'))) {
    return {
      message: 'Heartbeat rejected during rebalance',
      detail: err || 'Temporary — consumer will rejoin',
      context: context ?? 'Kafka',
    };
  }
  if (lower.includes('consumer has joined')) {
    return {
      message: 'Consumer joined group',
      detail: groupId,
      context: context ?? 'Kafka',
    };
  }
  if (lower.includes('response heartbeat')) {
    return {
      message: 'Kafka heartbeat',
      detail: err || truncate(text.replace(/^Response\s+/i, ''), 120),
      context: context ?? 'Kafka',
    };
  }

  return {
    message: truncate(text.replace(/^Response\s+/i, '') || 'Kafka event', 120),
    detail: err || groupId || broker,
    context: context ?? 'Kafka',
  };
}

/**
 * Turn noisy Nest/Kafka/HTTP log strings into short human-readable messages.
 * Returns { message, detail?, context?, metadata?, raw_message? }
 */
function normalizeLogMessage(message, extra = {}) {
  const raw = String(message ?? '').trim();
  if (!raw) return { message: raw };

  const { context, text, json } = splitNestStyleLine(raw);
  const merged = { ...(json ?? {}), ...extra };
  const lower = `${text} ${raw}`.toLowerCase();

  const http = formatHttpMessage(merged, text || raw);
  if (http) {
    return {
      message: http.message,
      detail: http.detail,
      context: 'HTTP',
      metadata: json ?? undefined,
      raw_message: raw !== http.message ? raw : undefined,
    };
  }

  const isKafka =
    readString(merged, 'logger')?.toLowerCase() === 'kafkajs'
    || lower.includes('kafkajs')
    || lower.includes('kafka.railway')
    || context === 'Connection'
    || context === 'Runner'
    || context === 'ConsumerGroup'
    || /\[Connection\]|\[Runner\]|\[ConsumerGroup\]/i.test(raw);

  if (isKafka) {
    const kafka = formatKafkaMessage(text, json, context ?? 'Kafka');
    return {
      message: kafka.message,
      detail: kafka.detail,
      context: kafka.context,
      metadata: json ?? undefined,
      raw_message: raw !== kafka.message ? raw : undefined,
    };
  }

  const err = readString(merged, 'error', 'message', 'msg', 'detail');
  if (err && err !== text && (text.includes('{') || text.length > err.length)) {
    return {
      message: truncate(err, 200),
      detail: text && !text.includes(err) ? truncate(text, 120) : undefined,
      context: context ?? undefined,
      metadata: json ?? undefined,
      raw_message: raw,
    };
  }

  if (json?.error && typeof json.error === 'string') {
    return {
      message: truncate(json.error, 200),
      detail: text ? truncate(text, 120) : undefined,
      context: context ?? undefined,
      metadata: json,
      raw_message: raw,
    };
  }

  if (text && text.length < raw.length) {
    return {
      message: truncate(text, 200),
      detail: undefined,
      context: context ?? undefined,
      metadata: json ?? undefined,
      raw_message: raw,
    };
  }

  if (raw.length > 220) {
    return { message: truncate(raw, 200), raw_message: raw };
  }

  return { message: raw };
}

module.exports = { normalizeLogMessage, splitNestStyleLine, tryParseJson };
