import { Injectable, Logger } from '@nestjs/common';
import {
  InternalIdentifierLeakError,
  LeakKind,
  LeakSurface,
} from './internal-identifier-leak.error';
import { getCorrelationId } from './secure-logging';

/**
 * Matches a UUID of ANY version/variant (v1–v8, nil, and non-RFC-4122 ids).
 *
 * The legacy RedactionService used a strict RFC-4122 pattern
 * (`[1-5]` version nibble, `[89ab]` variant nibble) which silently passes
 * UUIDv7 / nil / non-conformant database identifiers. This pattern closes that
 * hole by accepting any hex in the version and variant positions.
 */
const UUID_ANY = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const JWT = 'eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+';

const INTERNAL_URL =
  'https?:\\/\\/(?:localhost|[\\w.-]+)(?::\\d+)?\\/(?:v1|api|internal)\\/[\\w./-]+';

const CREDENTIAL = '(?:x-service-token|authorization|bearer)\\s*[:=]\\s*\\S+';

const BOOKING_TOOL_NAME =
  '(?:search_clinics|list_doctors|get_available_slots|book_appointment|get_upcoming_appointments|modify_appointment|cancel_appointment)';

const BRACKETED_TOOL_CALL = new RegExp(`\\[\\s*${BOOKING_TOOL_NAME}\\s*\\([^\\]]*\\)\\s*\\]`, 'gi');
const INLINE_TOOL_CALL = new RegExp(`\\b${BOOKING_TOOL_NAME}\\s*\\([^\\n\\r)]*\\)`, 'gi');
const TOOL_JSON_BLOCK = new RegExp(
  `\\{\\s*"tool"\\s*:\\s*"${BOOKING_TOOL_NAME}"\\s*,\\s*"params"\\s*:[\\s\\S]*?\\}`,
  'gi',
);
const TOOL_SUMMARY_PREFIX = /\bTOOL\s+[a-z_]+\s+SUMMARY:\s*/gi;

interface DetectorSpec {
  kind: LeakKind;
  detect: RegExp;
  redact: RegExp;
  token: string;
}

/**
 * Centralized, fail-closed guard for the two trust boundaries in the booking
 * flow: text going INTO an LLM prompt, and text going OUT to the user.
 *
 * - `assertPromptClean` throws {@link InternalIdentifierLeakError} so an internal
 *   identifier is never shipped to the model (prompts must contain opaque refs
 *   only — CLN-/DOC-/SLT-/APT-).
 * - `sanitizeUserResponse` strips any identifier that survived so the user can
 *   still receive a usable reply with zero internal ids.
 */
@Injectable()
export class OutboundSanitizerService {
  private readonly logger = new Logger(OutboundSanitizerService.name);

  private readonly detectors: DetectorSpec[] = [
    {
      kind: 'uuid',
      detect: new RegExp(`\\b${UUID_ANY}\\b`, 'i'),
      redact: new RegExp(`\\b${UUID_ANY}\\b`, 'gi'),
      token: '[redacted-id]',
    },
    {
      kind: 'jwt',
      detect: new RegExp(`\\b${JWT}\\b`),
      redact: new RegExp(`\\b${JWT}\\b`, 'g'),
      token: '[redacted-token]',
    },
    {
      kind: 'internal_url',
      detect: new RegExp(INTERNAL_URL, 'i'),
      redact: new RegExp(INTERNAL_URL, 'gi'),
      token: '[redacted-endpoint]',
    },
    {
      kind: 'credential',
      detect: new RegExp(CREDENTIAL, 'i'),
      redact: new RegExp(CREDENTIAL, 'gi'),
      token: '[redacted-credential]',
    },
  ];

  /** Returns the first leak kind found in the text, or null if clean. */
  findLeak(text: string): LeakKind | null {
    if (!text) return null;
    for (const spec of this.detectors) {
      if (spec.detect.test(text)) {
        return spec.kind;
      }
    }
    return null;
  }

  /**
   * Fail-closed guard for outbound LLM prompts. Throws if any internal
   * identifier is present so the value never reaches the model.
   */
  assertPromptClean(text: string): void {
    this.assertClean(text, 'prompt');
  }

  /** Strict assertion usable for replies/summaries in tests or strict mode. */
  assertClean(text: string, surface: LeakSurface): void {
    const kind = this.findLeak(text);
    if (kind) {
      this.logger.error({
        correlationId: getCorrelationId(),
        reason: 'internal_identifier_leak',
        surface,
        kind,
      });
      throw new InternalIdentifierLeakError(surface, kind);
    }
  }

  /**
   * Removes every internal identifier from user-facing text. Never throws so the
   * user always gets a reply; the leak is redacted, not surfaced.
   */
  sanitizeUserResponse(text: string): string {
    if (!text) return text;
    let out = text;
    let leaked = false;

    const stripped = this.stripToolArtifacts(out);
    if (stripped.changed) {
      out = stripped.text;
      leaked = true;
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'outbound_reply_tool_artifact_removed',
      });
    }

    for (const spec of this.detectors) {
      if (spec.detect.test(out)) {
        leaked = true;
        out = out.replace(spec.redact, spec.token);
      }
    }
    if (leaked) {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'outbound_reply_redacted',
      });
    }
    return this.normalizeReplyText(out);
  }

  private stripToolArtifacts(text: string): { text: string; changed: boolean } {
    let out = text;
    const before = out;
    out = out
      .replace(TOOL_JSON_BLOCK, '')
      .replace(BRACKETED_TOOL_CALL, '')
      .replace(INLINE_TOOL_CALL, '')
      .replace(TOOL_SUMMARY_PREFIX, '');
    return { text: out, changed: out !== before };
  }

  private normalizeReplyText(text: string): string {
    const compact = text
      .replace(/\s+([,.;!?])/g, '$1')
      .replace(/([,.;!?])\s*([,.;!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (!compact) {
      return 'I can help with that. Please rephrase your request in plain language.';
    }
    return compact;
  }
}
