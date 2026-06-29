import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SummarizationService } from '../src/ai/memory/summarization.service';
import { ConversationService } from '../src/ai/memory/conversation.service';
import { ConsentService } from '../src/ai/memory/consent.service';
import { MemoryAuditService } from '../src/ai/memory/memory-audit.service';
import { RedactionService } from '../src/ai/security/redaction.service';
import { LanguageDetectionService } from '../src/ai/memory/language-detection.service';
import { DeepSeekService } from '../src/ai/services/deepseek.service';
import { GeminiService } from '../src/ai/services/gemini.service';
import { AiConversationSummary } from '../src/ai/entities/ai-conversation-summary.entity';
import {
  SUMMARY_PROMPT_VERSION,
  SUMMARY_UNAVAILABLE,
  validateSummaryContent,
  wrapSummaryForPrompt,
} from '../src/ai/memory/summary-validation';

function memoryConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    MEMORY_SUMMARIZATION: 'true',
    MEMORY_SUMMARIZATION_TURN_INTERVAL: '6',
    ...overrides,
  };
  return {
    get: (key: string) => map[key],
    getOrThrow: (key: string) => {
      if (!map[key]) throw new Error(`Missing config ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;
}

describe('summary-validation', () => {
  it('rejects UUIDs, refs, emails, phones, and long quotes', () => {
    expect(validateSummaryContent('Patient asked about APT-AB12').valid).toBe(false);
    expect(validateSummaryContent('Contact user@example.com for details').valid).toBe(false);
    expect(
      validateSummaryContent(
        'User said "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone"',
      ).valid,
    ).toBe(false);
  });

  it('accepts generalized clinic references and preferences', () => {
    expect(
      validateSummaryContent(
        'Patient asked about cardiology clinics in Damascus and prefers morning appointments.',
      ).valid,
    ).toBe(true);
  });

  it('wraps summaries as untrusted XML', () => {
    expect(wrapSummaryForPrompt('General booking intent noted.')).toBe(
      '<conversation_summary>\nGeneral booking intent noted.\n</conversation_summary>',
    );
  });
});

describe('SummarizationService', () => {
  let service: SummarizationService;
  let conversation: jest.Mocked<
    Pick<
      ConversationService,
      'listDecryptedMessages' | 'saveSummaryRecord' | 'decryptSummaryRecord'
    >
  >;
  let consent: jest.Mocked<Pick<ConsentService, 'hasConsent'>>;
  let audit: jest.Mocked<Pick<MemoryAuditService, 'append'>>;
  let summaries: Map<string, AiConversationSummary>;
  let llmCalls: number;

  const patientId = randomUUID();
  const threadId = randomUUID();

  const messages = [
    {
      id: randomUUID(),
      threadId,
      seq: 1,
      role: 'user' as const,
      plaintext: 'Find cardiology clinics in Damascus',
      detectedLang: 'en',
      createdAt: new Date(),
    },
    {
      id: randomUUID(),
      threadId,
      seq: 2,
      role: 'assistant' as const,
      plaintext: 'I can help you browse cardiology options.',
      detectedLang: 'en',
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    summaries = new Map();
    llmCalls = 0;

    conversation = {
      listDecryptedMessages: jest.fn().mockResolvedValue(messages),
      saveSummaryRecord: jest.fn(async (pid, tid, input) => {
        const row = {
          id: randomUUID(),
          patientId: pid,
          threadId: tid,
          version: input.version,
          inputSeqFrom: input.inputSeqFrom,
          inputSeqTo: input.inputSeqTo,
          summaryLang: input.summaryLang,
          summaryPromptVersion: input.summaryPromptVersion,
          ciphertext: Buffer.from('cipher'),
          nonce: Buffer.from('nonce'),
          keyVersion: 1,
          source: input.source,
          modelId: input.modelId,
          createdAt: new Date(),
        } as AiConversationSummary;
        summaries.set(row.id, row);
        return row;
      }),
      decryptSummaryRecord: jest.fn(),
    };

    consent = {
      hasConsent: jest.fn().mockResolvedValue(true),
    };

    audit = {
      append: jest.fn().mockResolvedValue(undefined),
    };

    const summaryRepo = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      findOne: jest.fn(async ({ where, order }: any) => {
        const rows = [...summaries.values()].filter((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.patientId && row.patientId !== where.patientId) return false;
          if (where.threadId && row.threadId !== where.threadId) return false;
          if (where.supersededAt === null && row.supersededAt) return false;
          return true;
        });
        if (order?.version === 'DESC') {
          rows.sort((a, b) => b.version - a.version);
        }
        return rows[0] || null;
      }),
    };

    service = new SummarizationService(
      memoryConfig(),
      conversation as unknown as ConversationService,
      consent as unknown as ConsentService,
      audit as unknown as MemoryAuditService,
      new RedactionService(),
      new LanguageDetectionService(),
      { isConfigured: () => false } as unknown as DeepSeekService,
      {} as GeminiService,
      summaryRepo as any,
    );

    service.setLlmGenerator(async () => {
      llmCalls += 1;
      return {
        text: 'Patient asked about cardiology clinics and prefers morning appointments.',
        modelId: 'test-model',
      };
    });
  });

  it('does nothing when MEMORY_SUMMARIZATION is disabled', async () => {
    const disabled = new SummarizationService(
      memoryConfig({ MEMORY_SUMMARIZATION: 'false' }),
      conversation as unknown as ConversationService,
      consent as unknown as ConsentService,
      audit as unknown as MemoryAuditService,
      new RedactionService(),
      new LanguageDetectionService(),
      { isConfigured: () => false } as unknown as DeepSeekService,
      {} as GeminiService,
      { update: jest.fn(), findOne: jest.fn() } as any,
    );

    const result = await disabled.summarizeThread(patientId, threadId);
    expect(result).toBeNull();
    expect(conversation.saveSummaryRecord).not.toHaveBeenCalled();
  });

  it('requires summarization consent', async () => {
    consent.hasConsent.mockResolvedValue(false);
    const result = await service.summarizeThread(patientId, threadId);
    expect(result).toBeNull();
    expect(conversation.saveSummaryRecord).not.toHaveBeenCalled();
  });

  it('persists provenance fields and emits summary.created', async () => {
    const saved = await service.summarizeThread(patientId, threadId, { source: 'llm' });

    expect(saved).toBeDefined();
    expect(conversation.saveSummaryRecord).toHaveBeenCalledWith(
      patientId,
      threadId,
      expect.objectContaining({
        inputSeqFrom: 1,
        inputSeqTo: 2,
        summaryLang: 'en',
        summaryPromptVersion: SUMMARY_PROMPT_VERSION,
        source: 'llm',
        modelId: 'test-model',
      }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'summary.created',
        patientId,
        metadata: expect.objectContaining({
          summaryPromptVersion: SUMMARY_PROMPT_VERSION,
          summaryLang: 'en',
          source: 'llm',
        }),
      }),
    );
  });

  it('retries once and stores placeholder when validation keeps failing', async () => {
    service.setLlmGenerator(async () => {
      llmCalls += 1;
      return {
        text: 'Please call +963991234567 about APT-AB12',
        modelId: 'test-model',
      };
    });

    const saved = await service.summarizeThread(patientId, threadId);

    expect(llmCalls).toBe(2);
    expect(conversation.saveSummaryRecord).toHaveBeenCalledWith(
      patientId,
      threadId,
      expect.objectContaining({
        plaintext: SUMMARY_UNAVAILABLE,
      }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'summary.validation_failed',
        patientId,
      }),
    );
    expect(audit.append).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'summary.created' }),
    );
    expect(saved?.source).toBe('llm');
  });

  it('schedules summarization only on configured turn interval', async () => {
    const summarizeSpy = jest
      .spyOn(service, 'summarizeThread')
      .mockResolvedValue(null as any);

    service.scheduleSummaryIfNeeded(patientId, threadId, 5);
    await new Promise((resolve) => setImmediate(resolve));
    expect(summarizeSpy).not.toHaveBeenCalled();

    service.scheduleSummaryIfNeeded(patientId, threadId, 6);
    await new Promise((resolve) => setImmediate(resolve));
    expect(summarizeSpy).toHaveBeenCalledWith(patientId, threadId, { source: 'llm' });
  });

  it('emits summary.regenerated when source is regenerated', async () => {
    await service.summarizeThread(patientId, threadId, { source: 'regenerated' });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'summary.regenerated' }),
    );
  });

  it('wraps summaries for prompt consumers as untrusted content', () => {
    expect(service.wrapSummaryForPrompt('General intent only.')).toContain(
      '<conversation_summary>',
    );
  });
});
