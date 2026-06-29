import { Injectable } from '@nestjs/common';

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const INTERNAL_URL_PATTERN =
  /\bhttps?:\/\/(?:localhost|[\w.-]+)(?::\d+)?\/(?:v1|api)\/[\w./-]+/gi;

@Injectable()
export class RedactionService {
  redactOutput(text: string): string {
    if (!text) return text;
    return this.applyRedactions(text);
  }

  sanitizeUserInput(text: string): string {
    if (!text) return text;
    return this.applyRedactions(text.trim());
  }

  redactValue(value: unknown): unknown {
    if (typeof value === 'string') return this.redactOutput(value);
    if (Array.isArray(value)) return value.map((item) => this.redactValue(item));
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(record)) {
        out[key] = this.redactValue(nested);
      }
      return out;
    }
    return value;
  }

  private applyRedactions(text: string): string {
    return text
      .replace(UUID_PATTERN, '[redacted-id]')
      .replace(JWT_PATTERN, '[redacted-token]')
      .replace(INTERNAL_URL_PATTERN, '[redacted-endpoint]')
      .replace(/\b(x-service-token|authorization|bearer)\s*[:=]\s*\S+/gi, '[redacted-credential]');
  }
}
