import { Injectable } from '@nestjs/common';

export interface InjectionAssessment {
  blocked: boolean;
  reason?: string;
}

const EMBEDDED_TOOL_JSON = /\{\s*["']?tool["']?\s*:/i;
const FENCED_TOOL_JSON = /```[\s\S]*?\{\s*["']?tool["']?\s*:/i;
const BASE64_TOOL_HINT = /[A-Za-z0-9+/]{40,}={0,2}/;

const HIGH_CONFIDENCE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(show|reveal|print|repeat|dump|output|display|tell me)\b[\s\S]{0,40}\b(system prompt|hidden context|internal instructions|tool output|tool result|raw json)\b/i,
    reason: 'explicit_internal_data_request',
  },
  {
    pattern:
      /\b(show|reveal|give|print|list)\b[\s\S]{0,30}\b(uuid|uuids|appointment id|patient id|clinic id|doctor id|token|jwt|bearer)\b/i,
    reason: 'explicit_identifier_request',
  },
  {
    pattern: /\b(what is|show me)\b[\s\S]{0,25}\b(your|the)\b[\s\S]{0,20}\b(prompt|instructions)\b/i,
    reason: 'explicit_prompt_request',
  },
];

@Injectable()
export class InjectionDetectorService {
  assessUserMessage(message: string): InjectionAssessment {
    const text = message.trim();
    if (!text) return { blocked: false };

    if (EMBEDDED_TOOL_JSON.test(text)) {
      return { blocked: true, reason: 'embedded_tool_json' };
    }

    if (FENCED_TOOL_JSON.test(text)) {
      return { blocked: true, reason: 'fenced_tool_json' };
    }

    const base64Match = text.match(BASE64_TOOL_HINT);
    if (base64Match) {
      try {
        const decoded = Buffer.from(base64Match[0], 'base64').toString('utf8');
        if (EMBEDDED_TOOL_JSON.test(decoded)) {
          return { blocked: true, reason: 'encoded_tool_call' };
        }
      } catch {
        // ignore invalid base64
      }
    }

    for (const { pattern, reason } of HIGH_CONFIDENCE_PATTERNS) {
      if (pattern.test(text)) {
        return { blocked: true, reason };
      }
    }

    return { blocked: false };
  }
}
