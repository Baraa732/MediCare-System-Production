import { Injectable } from '@nestjs/common';
import { GeminiService } from '../services/gemini.service';
import {
  LlmGenerateOptions,
  LlmGenerateResponse,
  LlmMessage,
  LlmProvider,
  LlmToolDefinition,
} from './llm-provider';

interface PlannerJson {
  type?: 'tool' | 'answer';
  tool?: string;
  params?: Record<string, unknown>;
  answer?: string;
}

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly providerName = 'gemini';

  constructor(private readonly gemini: GeminiService) {}

  isConfigured(): boolean {
    return this.gemini.isConfigured();
  }

  async ensureAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const status = await this.gemini.checkHealth();
    return status.reachable;
  }

  async generate(
    messages: LlmMessage[],
    tools: LlmToolDefinition[],
    options?: LlmGenerateOptions,
  ): Promise<LlmGenerateResponse> {
    const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content.trim());
    const nonSystem = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `[${m.role.toUpperCase()}] ${m.content.trim()}`)
      .join('\n\n');

    const toolsJson = JSON.stringify(tools, null, 2);
    const systemPrompt = [
      ...systemMessages,
      'You are a strict JSON planner.',
      'Return JSON only. Do not include markdown fences.',
      'Format:',
      '{"type":"tool","tool":"<tool_name>","params":{...}}',
      'or',
      '{"type":"answer","answer":"<final_user_reply>"}',
      'If no tool is needed, return type="answer".',
      'Never output internal reasoning.',
    ].join('\n');

    const userPrompt = [
      'Available tools:',
      toolsJson,
      '',
      'Conversation:',
      nonSystem || '[USER] (empty)',
    ].join('\n');

    const result = await this.gemini.generateChat(systemPrompt, userPrompt, {
      maxTokens: options?.maxTokens ?? 700,
      temperature: options?.temperature ?? 0.2,
    });

    const parsed = this.parsePlannerJson(result.text);
    if (parsed?.type === 'tool' && parsed.tool) {
      return {
        text: '',
        toolCall: {
          name: parsed.tool,
          args: parsed.params && typeof parsed.params === 'object' ? parsed.params : {},
        },
      };
    }
    if (parsed?.type === 'answer' && parsed.answer) {
      return { text: parsed.answer };
    }
    return { text: result.text };
  }

  private parsePlannerJson(text: string): PlannerJson | null {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '');

    try {
      return JSON.parse(cleaned) as PlannerJson;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]) as PlannerJson;
      } catch {
        return null;
      }
    }
  }
}
