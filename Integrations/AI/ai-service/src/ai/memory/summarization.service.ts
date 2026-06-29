import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DeepSeekService } from '../services/deepseek.service';
import { GeminiService } from '../services/gemini.service';
import { RedactionService } from '../security/redaction.service';
import { AiConversationSummary } from '../entities/ai-conversation-summary.entity';
import { ConsentService } from './consent.service';
import { ConversationService } from './conversation.service';
import { LanguageDetectionService } from './language-detection.service';
import { MemoryAuditService } from './memory-audit.service';
import { SummarySource } from './memory.types';
import {
  SUMMARY_PROMPT_VERSION,
  SUMMARY_UNAVAILABLE,
  validateSummaryContent,
  wrapSummaryForPrompt,
} from './summary-validation';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

const SUMMARY_SYSTEM_PROMPTS: Record<string, string> = {
  en: `You summarize clinic booking conversations for internal assistant context only.
Rules:
- Paraphrase; never quote the user verbatim for more than a few words.
- Do NOT include person names, clinic names, doctor names, UUIDs, appointment references (APT-, CLN-, DOC-, SLT-), emails, phone numbers, or calendar dates with day precision.
- You MAY include general clinic types, regions, booking intent, and time-of-day preferences.
Respond with 2-4 short sentences only.`,
  ar: `لخّص محادثات حجز العيادة لسياق المساعد الداخلي فقط.
القواعد:
- أعد الصياغة؛ لا تقتبس المستخدم حرفياً لأكثر من بضع كلمات.
- لا تُدرج أسماء الأشخاص أو العيادات أو الأطباء أو المعرفات أو مراجع المواعيد (APT- أو CLN- أو DOC- أو SLT-) أو البريد الإلكتروني أو أرقام الهاتف أو تواريخ التقويم بدقة اليوم.
- يمكنك ذكر أنواع العيادات العامة والمناطق ونية الحجز وتفضيلات وقت اليوم.
أجب بجملتين إلى أربع جمل قصيرة فقط.`,
  fr: `Vous résumez des conversations de réservation en clinique pour le contexte interne de l'assistant uniquement.
Règles :
- Paraphrasez ; ne citez jamais l'utilisateur mot pour mot sur plus de quelques mots.
- N'incluez PAS de noms de personnes, de cliniques, de médecins, d'UUID, de références de rendez-vous (APT-, CLN-, DOC-, SLT-), d'e-mails, de numéros de téléphone ou de dates calendaires précises au jour près.
- Vous POUVEZ inclure des types de cliniques généraux, des régions, l'intention de réservation et les préférences d'heure de la journée.
Répondez en 2 à 4 phrases courtes seulement.`,
};

export interface SummarizeOptions {
  source?: SummarySource;
  preferredLanguage?: string;
  inputSeqFrom?: number;
  inputSeqTo?: number;
}

export type SummaryLlmGenerator = (
  systemPrompt: string,
  userMessage: string,
) => Promise<{ text: string; modelId: string }>;

@Injectable()
export class SummarizationService {
  private readonly logger = new Logger(SummarizationService.name);
  private llmGenerator?: SummaryLlmGenerator;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversation: ConversationService,
    private readonly consent: ConsentService,
    private readonly audit: MemoryAuditService,
    private readonly redaction: RedactionService,
    private readonly languageDetection: LanguageDetectionService,
    private readonly deepSeek: DeepSeekService,
    private readonly gemini: GeminiService,
    @InjectRepository(AiConversationSummary)
    private readonly summaryRepo: Repository<AiConversationSummary>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private resolveTenantId(): string | undefined {
    return this.tenantContext.getTenantId() ?? undefined;
  }

  private summaryWhere(
    base: Record<string, unknown>,
  ): Record<string, unknown> {
    const tenantId = this.resolveTenantId();
    return tenantId ? { ...base, tenantId } : base;
  }

  /** Test hook — avoids live LLM calls in unit tests. */
  setLlmGenerator(generator: SummaryLlmGenerator | undefined): void {
    this.llmGenerator = generator;
  }

  isEnabled(): boolean {
    return this.config.get<string>('MEMORY_SUMMARIZATION') === 'true';
  }

  wrapSummaryForPrompt(summary: string): string {
    return wrapSummaryForPrompt(summary);
  }

  scheduleSummaryIfNeeded(
    patientId: string,
    threadId: string,
    messageCount: number,
  ): void {
    if (!this.isEnabled()) return;

    void this.maybeSummarize(patientId, threadId, messageCount).catch((error) => {
      this.logger.warn({
        reason: 'summary_schedule_failed',
        patientId,
        threadId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    });
  }

  async summarizeThread(
    patientId: string,
    threadId: string,
    options: SummarizeOptions = {},
  ): Promise<AiConversationSummary | null> {
    if (!this.isEnabled()) return null;
    if (!(await this.consent.hasConsent(patientId, 'summarization'))) return null;

    const messages = await this.conversation.listDecryptedMessages(patientId, threadId);
    if (!messages.length) return null;

    const inputSeqFrom = options.inputSeqFrom ?? messages[0].seq;
    const inputSeqTo = options.inputSeqTo ?? messages[messages.length - 1].seq;
    const scoped = messages.filter((m) => m.seq >= inputSeqFrom && m.seq <= inputSeqTo);
    if (!scoped.length) return null;

    const summaryLang = this.languageDetection.resolveSummaryLanguage(
      scoped,
      options.preferredLanguage,
    );

    const redactedTurns = scoped.map((message) => ({
      role: message.role,
      text: this.redaction.redactOutput(message.plaintext),
    }));

    const source = options.source || 'llm';
    const { plaintext, modelId, validationFailed } = await this.generateValidatedSummary(
      redactedTurns,
      summaryLang,
    );

    await this.markSummariesSuperseded(patientId, threadId);
    const version = await this.getNextSummaryVersion(patientId, threadId);

    const saved = await this.conversation.saveSummaryRecord(patientId, threadId, {
      version,
      inputSeqFrom,
      inputSeqTo,
      summaryLang,
      summaryPromptVersion: SUMMARY_PROMPT_VERSION,
      plaintext,
      source,
      modelId,
    });

    if (validationFailed) {
      await this.audit.append({
        action: 'summary.validation_failed',
        patientId,
        resourceType: 'summary',
        resourceId: saved.id,
        reasonCode: 'post_validation_failed',
        metadata: {
          threadId,
          inputSeqFrom,
          inputSeqTo,
          summaryPromptVersion: SUMMARY_PROMPT_VERSION,
        },
      });
    } else {
      await this.audit.append({
        action: this.auditActionForSource(source),
        patientId,
        resourceType: 'summary',
        resourceId: saved.id,
        metadata: {
          threadId,
          inputSeqFrom,
          inputSeqTo,
          summaryLang,
          summaryPromptVersion: SUMMARY_PROMPT_VERSION,
          source,
          modelId,
        },
      });
    }

    return saved;
  }

  async regenerateSummary(
    patientId: string,
    threadId: string,
    preferredLanguage?: string,
  ): Promise<AiConversationSummary | null> {
    const latest = await this.getLatestActiveSummary(patientId, threadId);
    const inputSeqFrom = latest?.inputSeqFrom ?? 1;
    const inputSeqTo =
      latest?.inputSeqTo ??
      (await this.conversation.listDecryptedMessages(patientId, threadId)).slice(-1)[0]?.seq;

    if (!inputSeqTo) return null;

    return this.summarizeThread(patientId, threadId, {
      source: 'regenerated',
      preferredLanguage,
      inputSeqFrom,
      inputSeqTo,
    });
  }

  async redactSummary(
    patientId: string,
    summaryId: string,
  ): Promise<AiConversationSummary | null> {
    if (!this.isEnabled()) return null;
    if (!(await this.consent.hasConsent(patientId, 'summarization'))) return null;

    const row = await this.summaryRepo.findOne({
      where: this.summaryWhere({ id: summaryId, patientId }) as never,
    });
    if (!row) {
      throw new NotFoundException('Summary not found');
    }

    const { plaintext } = await this.decryptSummary(patientId, summaryId);
    const redacted = this.redaction.redactOutput(plaintext);
    const validation = validateSummaryContent(redacted);
    const finalText = validation.valid ? redacted : SUMMARY_UNAVAILABLE;

    await this.markSummariesSuperseded(patientId, row.threadId);
    const version = await this.getNextSummaryVersion(patientId, row.threadId);

    const saved = await this.conversation.saveSummaryRecord(patientId, row.threadId, {
      version,
      inputSeqFrom: row.inputSeqFrom,
      inputSeqTo: row.inputSeqTo,
      summaryLang: row.summaryLang,
      summaryPromptVersion: row.summaryPromptVersion,
      plaintext: finalText,
      source: 'redacted',
      modelId: row.modelId,
    });

    if (!validation.valid) {
      await this.audit.append({
        action: 'summary.validation_failed',
        patientId,
        resourceType: 'summary',
        resourceId: saved.id,
        reasonCode: validation.reason,
        metadata: { threadId: row.threadId, source: 'redacted' },
      });
    }

    await this.audit.append({
      action: 'summary.redacted',
      patientId,
      resourceType: 'summary',
      resourceId: saved.id,
      metadata: {
        threadId: row.threadId,
        priorSummaryId: summaryId,
        inputSeqFrom: row.inputSeqFrom,
        inputSeqTo: row.inputSeqTo,
      },
    });

    return saved;
  }

  private async maybeSummarize(
    patientId: string,
    threadId: string,
    messageCount: number,
  ): Promise<void> {
    if (!(await this.consent.hasConsent(patientId, 'summarization'))) return;

    const interval = this.turnInterval();
    if (messageCount < interval || messageCount % interval !== 0) return;

    await this.summarizeThread(patientId, threadId, { source: 'llm' });
  }

  private turnInterval(): number {
    const raw = this.config.get<string>('MEMORY_SUMMARIZATION_TURN_INTERVAL') || '6';
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
  }

  private async generateValidatedSummary(
    turns: { role: string; text: string }[],
    summaryLang: string,
  ): Promise<{ plaintext: string; modelId?: string; validationFailed: boolean }> {
    const systemPrompt = this.systemPromptForLang(summaryLang);
    const userMessage = this.formatTurnsForPrompt(turns);

    let modelId: string | undefined;
    let candidate = '';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const generated = await this.callLlm(systemPrompt, userMessage, attempt > 0);
      modelId = generated.modelId;
      candidate = generated.text.trim();

      const validation = validateSummaryContent(candidate);
      if (validation.valid) {
        return { plaintext: candidate, modelId, validationFailed: false };
      }
    }

    return { plaintext: SUMMARY_UNAVAILABLE, modelId, validationFailed: true };
  }

  private systemPromptForLang(lang: string): string {
    return SUMMARY_SYSTEM_PROMPTS[lang] || SUMMARY_SYSTEM_PROMPTS.en;
  }

  private formatTurnsForPrompt(turns: { role: string; text: string }[]): string {
    return turns.map((turn) => `[${turn.role}] ${turn.text}`).join('\n');
  }

  private async callLlm(
    systemPrompt: string,
    userMessage: string,
    isRetry: boolean,
  ): Promise<{ text: string; modelId: string }> {
    const retrySuffix = isRetry
      ? '\n\nIMPORTANT: Your previous answer contained forbidden identifiers. Remove all names, IDs, dates, emails, and phone numbers.'
      : '';
    const effectiveUser = userMessage + retrySuffix;

    if (this.llmGenerator) {
      return this.llmGenerator(systemPrompt, effectiveUser);
    }

    const provider = (this.config.get<string>('AI_PROVIDER') || 'gemini').toLowerCase();

    if (provider === 'deepseek' && this.deepSeek.isConfigured()) {
      const result = await this.deepSeek.generateChat(systemPrompt, effectiveUser, {
        maxTokens: 300,
        temperature: 0.2,
      });
      return {
        text: result.text,
        modelId: this.config.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat',
      };
    }

    const result = await this.gemini.generateChat(systemPrompt, effectiveUser, {
      maxTokens: 300,
      temperature: 0.2,
    });
    return {
      text: result.text,
      modelId: this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash',
    };
  }

  private auditActionForSource(source: SummarySource): 'summary.created' | 'summary.regenerated' | 'summary.redacted' {
    if (source === 'regenerated') return 'summary.regenerated';
    if (source === 'redacted') return 'summary.redacted';
    return 'summary.created';
  }

  private async markSummariesSuperseded(patientId: string, threadId: string): Promise<void> {
    await this.summaryRepo.update(
      this.summaryWhere({ patientId, threadId, supersededAt: IsNull() }) as never,
      { supersededAt: new Date() },
    );
  }

  private async getNextSummaryVersion(patientId: string, threadId: string): Promise<number> {
    const latest = await this.summaryRepo.findOne({
      where: this.summaryWhere({ patientId, threadId }) as never,
      order: { version: 'DESC' },
    });
    return (latest?.version || 0) + 1;
  }

  private async getLatestActiveSummary(
    patientId: string,
    threadId: string,
  ): Promise<AiConversationSummary | null> {
    return this.summaryRepo.findOne({
      where: this.summaryWhere({ patientId, threadId, supersededAt: IsNull() }) as never,
      order: { version: 'DESC' },
    });
  }

  private async decryptSummary(
    patientId: string,
    summaryId: string,
  ): Promise<{ plaintext: string; summary: AiConversationSummary }> {
    return this.conversation.decryptSummaryRecord(patientId, summaryId);
  }
}
