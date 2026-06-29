import type { PlatformLogLevel } from './platform-logs.service';

export interface ParsedLogLine {
  timestamp: string;
  level: PlatformLogLevel;
  service: string;
  message: string;
  raw: string;
  traceId: string | null;
  spanId: string | null;
  requestId: string | null;
}

const ANSI = /\x1b\[[0-9;]*m/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI, '').trim();
}

export function normalizeServiceLabel(label: string): string {
  const aliases: Record<string, string> = {
    'system_manager-service': 'system-manager-service',
    system_manager_service: 'system-manager-service',
  };
  return aliases[label] ?? label;
}

export function parseLogLine(raw: string, service: string, nanoTs?: string): ParsedLogLine | null {
  const cleaned = stripAnsi(raw);
  if (!cleaned) return null;

  let timestamp = nanoTs
    ? new Date(Number(nanoTs) / 1_000_000).toISOString()
    : new Date().toISOString();
  let message = cleaned;
  let json: Record<string, unknown> | null = null;

  if (cleaned.startsWith('{')) {
    try {
      json = JSON.parse(cleaned);
      message = String(json.message ?? json.msg ?? cleaned);
      timestamp = new Date(String(json.timestamp ?? json.time ?? timestamp)).toISOString();
    } catch {
      json = null;
    }
  }

  if (!json) {
    const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2}T[\d:.+-Z]+)\s+(.*)$/);
    if (isoMatch) {
      timestamp = new Date(isoMatch[1]).toISOString();
      message = isoMatch[2];
    } else {
      const nestMatch = cleaned.match(
        /\[Nest\]\s+\d+\s+-\s+(\d{1,2}\/\d{1,2}\/\d{4},?\s[\d:APM\s]+)\s+\w+\s+.*?\]\s+(.*)$/i,
      );
      if (nestMatch) {
        const parsed = new Date(nestMatch[1]);
        if (!Number.isNaN(parsed.getTime())) timestamp = parsed.toISOString();
        message = nestMatch[2].trim();
      }
    }
  }

  const level = json
    ? normalizeJsonLevel(String(json.level ?? json.severity ?? message))
    : detectLevel(cleaned);
  const normalizedService = normalizeServiceLabel(String(json?.service ?? service));

  return {
    timestamp,
    level,
    service: normalizedService,
    message: stripAnsi(message) || cleaned,
    raw: cleaned,
    traceId: pickId(json, cleaned, ['trace_id', 'traceId', 'traceID']),
    spanId: pickId(json, cleaned, ['span_id', 'spanId', 'spanID']),
    requestId: pickId(json, cleaned, ['request_id', 'requestId', 'correlation_id', 'x-request-id']),
  };
}

function pickId(json: Record<string, unknown> | null, message: string, keys: string[]): string | null {
  if (json) {
    for (const key of keys) {
      const val = json[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  const pattern = keys.includes('traceId') || keys.includes('trace_id')
    ? /trace[_-]?id[=:\s"']+([a-f0-9-]{8,36})/i
    : keys.includes('spanId') || keys.includes('span_id')
      ? /span[_-]?id[=:\s"']+([a-f0-9-]{8,36})/i
      : /request[_-]?id[=:\s"']+([a-f0-9-]{8,36})/i;
  const match = message.match(pattern);
  return match?.[1] ?? null;
}

function normalizeJsonLevel(value: string): PlatformLogLevel {
  const upper = value.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FATAL')) return 'ERROR';
  if (upper.includes('WARN')) return 'WARN';
  if (upper.includes('DEBUG')) return 'DEBUG';
  if (upper.includes('TRACE')) return 'TRACE';
  return 'INFO';
}

function detectLevel(line: string): PlatformLogLevel {
  if (/\bERROR\b/i.test(line) || /\bFATAL\b/i.test(line)) return 'ERROR';
  if (/\bWARN(?:ING)?\b/i.test(line)) return 'WARN';
  if (/\bDEBUG\b/i.test(line)) return 'DEBUG';
  if (/\bTRACE\b/i.test(line)) return 'TRACE';
  return 'INFO';
}
