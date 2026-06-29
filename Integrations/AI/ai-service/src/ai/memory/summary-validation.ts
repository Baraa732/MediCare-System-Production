export const SUMMARY_PROMPT_VERSION = 'v1.0';
export const SUMMARY_UNAVAILABLE = '[summary unavailable]';

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;

const REF_PATTERN = /\b(CLN|DOC|SLT|APT)-[A-Z0-9]{4}\b/;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const PHONE_PATTERN = /\b\+?\d[\d\s()-]{8,}\d\b/;

const ISO_DATE_PATTERN = /\b20\d{2}-\d{2}-\d{2}\b/;

const SLASH_DATE_PATTERN = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;

const DOCTOR_NAME_PATTERN = /\bDr\.?\s+[A-Z][a-z]/;

const FORBIDDEN_PATTERNS = [
  UUID_PATTERN,
  JWT_PATTERN,
  REF_PATTERN,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  ISO_DATE_PATTERN,
  SLASH_DATE_PATTERN,
  DOCTOR_NAME_PATTERN,
];

export function validateSummaryContent(text: string): { valid: boolean; reason?: string } {
  if (!text?.trim()) {
    return { valid: false, reason: 'empty_summary' };
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return { valid: false, reason: 'forbidden_identifier' };
    }
  }

  if (hasLongVerbatimQuote(text)) {
    return { valid: false, reason: 'long_verbatim_quote' };
  }

  return { valid: true };
}

function hasLongVerbatimQuote(text: string): boolean {
  const quoted = text.match(/"[^"]+"|'[^']+'/g) || [];
  for (const segment of quoted) {
    const inner = segment.slice(1, -1).trim();
    if (inner.split(/\s+/).filter(Boolean).length > 20) {
      return true;
    }
  }
  return false;
}

export function wrapSummaryForPrompt(summary: string): string {
  return `<conversation_summary>\n${summary.trim()}\n</conversation_summary>`;
}
