import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepSeekService } from './deepseek.service';
import { GeminiService } from './gemini.service';
import { PromptService } from './prompt.service';
import { AiCacheService } from './ai-cache.service';
import { AiRequestLogService } from './ai-request-log.service';
import { AiMetricsService } from './ai-metrics.service';
import { AiConcurrencyService } from './ai-concurrency.service';
import { OcrService } from './ocr.service';
import { PatientContextService } from './patient-context.service';
import { AppointmentHttpClient } from './appointment-http.client-v2';
import { OutboundSanitizerService } from '../security/outbound-sanitizer.service';
import {
  MedicalReportDto,
  OcrCleanupDto,
  PatientChatDto,
  DoctorChatDto,
  AppointmentNoteDto,
} from '../dto/ai.dto';

const PATIENT_DISCLAIMER =
  'Disclaimer: This is general health information only, not medical advice. Please consult your healthcare provider for personal medical decisions.';

const DOCTOR_DRAFT_PREFIX = '[AI-GENERATED DRAFT — Requires physician review]';

export interface AiCallContext {
  userId: string;
  role: string;
  endpoint: string;
}

export interface MedicalReportResult {
  summary: string;
  assessment: string;
  recommendations: string;
  followUp: string;
}

export interface OcrCleanupResult {
  rawText: string;
  cleanedText: string;
  structuredData: Record<string, unknown>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** llm = model only | template = FAQ scripts only | hybrid = model first, template fallback */
  private readonly patientChatMode: string;

  constructor(
    private deepSeekService: DeepSeekService,
    private geminiService: GeminiService,
    private promptService: PromptService,
    private cacheService: AiCacheService,
    private requestLogService: AiRequestLogService,
    private metricsService: AiMetricsService,
    private ocrService: OcrService,
    private patientContextService: PatientContextService,
    private configService: ConfigService,
    private outboundSanitizer: OutboundSanitizerService,
    private concurrencyService: AiConcurrencyService,
  ) {
    this.patientChatMode = this.configService.get<string>('PATIENT_CHAT_MODE') || 'hybrid';
  }

  private resolvePatientLlmProvider(): 'deepseek' | 'gemini' {
    const provider = this.configService.get<string>('PATIENT_CHAT_PROVIDER') || 'auto';
    if (provider === 'deepseek') return 'deepseek';
    if (provider === 'gemini') return 'gemini';
    if (this.geminiService.isConfigured()) return 'gemini';
    if (this.deepSeekService.isConfigured()) return 'deepseek';
    return 'gemini';
  }

  private resolveCoreLlmProvider(): 'deepseek' | 'gemini' {
    const provider = (this.configService.get<string>('AI_PROVIDER') || 'gemini').toLowerCase();
    if (provider === 'deepseek' && this.deepSeekService.isConfigured()) return 'deepseek';
    if (provider === 'gemini' && this.geminiService.isConfigured()) return 'gemini';
    if (this.geminiService.isConfigured()) return 'gemini';
    if (this.deepSeekService.isConfigured()) return 'deepseek';
    return 'gemini';
  }

  private async generatePatientLlmChat(
    systemPrompt: string,
    userMessage: string,
  ): Promise<{ text: string; promptTokens: number; completionTokens: number; provider: string }> {
    const llmProvider = this.resolvePatientLlmProvider();

    if (llmProvider === 'deepseek') {
      const result = await this.deepSeekService.generateChat(systemPrompt, userMessage, {
        maxTokens: 512,
        temperature: 0.5,
      });
      return { ...result, provider: 'deepseek' };
    }

    const result = await this.geminiService.generateChat(systemPrompt, userMessage, {
      maxTokens: 280,
      temperature: 0.5,
    });
    return { ...result, provider: 'gemini' };
  }

  private async generateCoreLlm(
    systemPrompt: string,
    userMessage: string,
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<{ text: string; promptTokens: number; completionTokens: number; provider: string }> {
    const provider = this.resolveCoreLlmProvider();
    if (provider === 'deepseek') {
      const result = await this.deepSeekService.generateChat(systemPrompt, userMessage, {
        maxTokens: opts?.maxTokens ?? 700,
        temperature: opts?.temperature ?? 0.3,
      });
      return { ...result, provider: 'deepseek' };
    }
    const result = await this.geminiService.generateChat(systemPrompt, userMessage, {
      maxTokens: opts?.maxTokens ?? 700,
      temperature: opts?.temperature ?? 0.3,
    });
    return { ...result, provider: 'gemini' };
  }

  private parseJsonResponse<T>(text: string): T {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          throw new BadRequestException('AI returned invalid JSON');
        }
      }
      throw new BadRequestException('AI returned invalid JSON');
    }
  }

  private ensureDisclaimer(text: string): string {
    if (text.includes('Disclaimer:')) return text;
    return `${text.trim()}\n\n${PATIENT_DISCLAIMER}`;
  }

  /** Strip Qwen3 chain-of-thought and meta-instruction leaks. */
  private cleanPatientAnswer(raw: string): string {
    let text = raw.trim();

    const thinkParts = text.split(/<\/think>|<\/redacted_thinking>/i);
    if (thinkParts.length > 1) {
      text = thinkParts[thinkParts.length - 1].trim();
    }

    text = text.replace(/^Answer:\s*/i, '').trim();
    return text;
  }

  private isBadPatientModelOutput(text: string): boolean {
    const body = text.split(/Disclaimer:/i)[0].trim();
    if (!body || body.length < 40) return true;

    const badPatterns = [
      /^steps:/i,
      /^\d+\.\s*(keep it|the patient|practical|we |do not|write|tell)/im,
      /the patient might/i,
      /we are given/i,
      /we must/i,
      /let'?s structure/i,
      /short sentences/i,
      /general tips only/i,
      /do not repeat/i,
      /do not show/i,
      /reasoning or planning/i,
      /meaning fasting/i,
      /so we don'?t go/i,
    ];

    return badPatterns.some((p) => p.test(body));
  }

  private isUselessPatientAnswer(answer: string, question: string): boolean {
    const body = answer.split(/Disclaimer:/i)[0].trim();
    if (this.isBadPatientModelOutput(body)) return true;
    if (body.length < 50) return true;

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const q = normalize(question);
    const a = normalize(body);
    if (a === q || (a.startsWith(q) && a.length < q.length + 30)) return true;

    return false;
  }

  /** Match patient questions to a known FAQ topic. More specific intents are checked first. */
  private resolvePatientTopic(question: string): string {
    const q = question.toLowerCase();

    if (
      /how long.*(take|procedure|visit|test|appointment|wait|last)|procedure.*take|approximately.*long|duration of|time will (the|it|my)/.test(
        q,
      )
    ) {
      return 'procedure_duration';
    }
    if (/how long.*result|when will i get|wait for.*result|result.*ready|turnaround/.test(q)) {
      return 'results';
    }
    if (/prepare|preparation|ready for|before my visit|before the test/.test(q) && /blood|lab|glucose|test/.test(q)) {
      return 'blood_prep';
    }
    if (/blood test|blood work|lab test|blood draw|cbc|cholesterol|glucose|prepare.*blood|blood.*prepare/.test(q)) {
      if (/prepare|preparation|ready for|before|fast|what should|how do i/.test(q)) {
        return 'blood_prep';
      }
      if (/come to|visit for|need.*test|would like|want to get|getting/.test(q)) {
        return 'procedure_duration';
      }
    }
    if (/morning|afternoon|evening|what time|what hour|should.*at|when should|empty stomach/.test(q)) {
      return 'timing_fasting';
    }
    if (/fast|fasting|not eat|without eating|skip breakfast/.test(q)) {
      return 'timing_fasting';
    }
    if (/coffee|tea|drink|water|juice|eat|food|alcohol|smoke|breakfast|lunch|dinner/.test(q)) {
      return 'drink_eat';
    }
    if (/medication|medicine|pill|drug|stop taking|continue taking|prescription/.test(q)) {
      return 'medication';
    }
    if (/result|results|report/.test(q)) {
      return 'results';
    }
    if (/appointment|when is my|schedule|reschedule|cancel|miss my|book/.test(q)) {
      return 'appointment';
    }
    if (/bring|insurance|id card|identification|documents|paperwork/.test(q)) {
      return 'what_to_bring';
    }
    if (/early|arrive|check in|check-in|late|waiting room/.test(q)) {
      return 'arrival';
    }
    if (/park|parking|where is the clinic|location|address|directions|find the/.test(q)) {
      return 'location';
    }
    if (/prepare|preparation|ready for|before my visit|before the test/.test(q)) {
      return 'general_prep';
    }
    if (/cost|pay|price|fee|insurance cover|copay|bill/.test(q)) {
      return 'billing';
    }
    if (
      /heart attack|cardiac arrest|myocardial|symptoms of a heart attack|heart attack symptoms|suspect.*heart attack|signs of a heart attack/.test(
        q,
      )
    ) {
      return 'emergency_heart';
    }
    if (/stroke|symptoms of a stroke|signs of a stroke|suspect.*stroke|fast test/.test(q)) {
      return 'emergency_stroke';
    }
    if (/what are.*symptoms|common symptoms|signs of|symptoms of/.test(q)) {
      return 'health_education';
    }
    if (/pain|hurt|symptom|feel|sick|worried|nervous|scared|anxious/.test(q)) {
      return 'symptoms';
    }

    return 'general';
  }

  private formatAppointmentContext(ctx?: string): string {
    if (!ctx?.trim()) return '';
    const cleaned = ctx.replace(/^appointment\s*/i, '').trim();
    return cleaned ? ` Your appointment is ${cleaned}.` : '';
  }

  /** Template answers — instant and reliable for patient chat. */
  private buildPatientAnswer(data: PatientChatDto): string {
    const q = data.question.toLowerCase();
    const ctx = data.context?.trim();
    const appt = this.formatAppointmentContext(ctx);
    const topic = this.resolvePatientTopic(data.question);

    switch (topic) {
      case 'procedure_duration': {
        const hasGlucose = /glucose|sugar|hba1c|a1c/.test(q);
        const hasBlood = /blood|lab|cbc|cholesterol/.test(q);
        const tests =
          hasBlood && hasGlucose
            ? 'blood work and glucose testing'
            : hasGlucose
              ? 'glucose testing'
              : hasBlood
                ? 'blood work'
                : 'lab tests';
        return (
          `A single blood draw usually takes only a few minutes. When you have ${tests}, the full visit typically takes about 15–30 minutes including check-in and any waiting time.${appt} ` +
          'Arrive a few minutes early with your photo ID and insurance card. Contact your clinic if you need a more precise estimate for your specific tests.'
        );
      }

      case 'blood_prep':
        return (
          `Wear comfortable clothing with sleeves that roll up easily, and bring your photo ID and insurance card.${appt} ` +
          'Many blood tests are done in the morning, especially if fasting is required — ask your clinic whether you need to fast for 8–12 hours before your test. ' +
          'Confirm the exact preparation steps with your doctor or lab staff.'
        );

      case 'timing_fasting':
        if (/blood|lab|test/.test(q)) {
          return (
            `Wear comfortable clothing and bring your photo ID and insurance card.${appt} ` +
            'Many blood tests are scheduled in the morning, especially when fasting is required — ask your clinic if you need to fast for 8–12 hours. ' +
            'Confirm the exact timing and preparation with your doctor or lab staff.'
          );
        }
        return (
          `Many lab tests are scheduled in the morning, particularly when fasting is required.${appt || ' For your visit,'} ` +
          'If fasting applies, you usually should not eat for 8–12 hours beforehand (water is often fine). ' +
          'Please confirm the exact timing and fasting rules with your clinic before your visit.'
        );

      case 'drink_eat':
        return (
          `Before lab tests, your clinic may ask you to avoid food, certain drinks, or alcohol for a set period.${appt} ` +
          'Water is usually allowed unless you are told otherwise. Avoid coffee, juice, or snacks unless your clinic confirms it is okay. ' +
          'Please check with your doctor or lab staff for instructions specific to your test.'
        );

      case 'medication':
        return (
          `Do not stop or change any prescribed medications on your own.${appt} ` +
          'Some tests require you to keep taking your usual medicines; others may need temporary adjustments — only your doctor can tell you what applies to you. ' +
          'Contact your clinic before your visit if you are unsure.'
        );

      case 'results':
        return (
          `Lab result times vary depending on the test.${appt} ` +
          'Many routine results are available within a few days through your clinic app or patient portal. ' +
          'Contact your clinic if you have not received results within the timeframe they gave you.'
        );

      case 'appointment':
        if (/cancel|miss|skip/.test(q)) {
          return (
            `If you need to cancel or miss your visit, contact the clinic as soon as possible.${appt} ` +
            'They can help you reschedule and tell you whether any preparation steps change for the new date. ' +
            'Use the clinic app or call the front desk to update your appointment.'
          );
        }
        return (
          `${ctx || 'Check your clinic app or confirmation message for the date and time'}. ` +
          'Please arrive a few minutes early and bring your ID and insurance card. ' +
          'Contact the clinic if you need to reschedule or have questions about preparation.'
        );

      case 'what_to_bring':
        return (
          `For most clinic visits, bring a photo ID, your insurance card, and any referral or lab order you received.${appt} ` +
          'If you take medications, a list of them can be helpful. ' +
          'Contact your clinic if you are unsure what to bring for your specific appointment.'
        );

      case 'arrival':
        return (
          `Plan to arrive about 10–15 minutes before your scheduled time.${appt} ` +
          'Bring your ID and insurance card, and check in at the front desk when you arrive. ' +
          'If you are running late, call the clinic so they can advise you.'
        );

      case 'location':
        return (
          `Check your appointment confirmation or the clinic app for the exact address and check-in location.${appt} ` +
          'If you need directions or parking information, contact the clinic front desk before your visit. ' +
          'Allow extra time if this is your first visit to the clinic.'
        );

      case 'general_prep':
        return (
          `Wear comfortable clothing and bring your photo ID and insurance card.${appt} ` +
          'Follow any instructions your clinic sent you about fasting, medications, or documents to bring. ' +
          'If you are unsure about preparation, contact your clinic staff before your visit.'
        );

      case 'billing':
        return (
          `Costs and insurance coverage depend on your plan and the services you receive.${appt} ` +
          'Bring your insurance card to your visit and ask the front desk about expected costs or copays. ' +
          'Contact your clinic billing office if you have questions about payment or coverage.'
        );

      case 'emergency_heart':
        return (
          'Common warning signs of a heart attack can include chest pain or pressure, discomfort spreading to the arm, jaw, neck, or back, shortness of breath, cold sweat, nausea, lightheadedness, or unexplained fatigue. Symptoms can differ between people and may be less typical in women. ' +
          'If you suspect a heart attack is happening now, call emergency services (911) immediately — do not drive yourself. Stay calm, rest, and follow instructions from emergency responders. ' +
          'This is general health education only, not a diagnosis of your situation.'
        );

      case 'emergency_stroke':
        return (
          'Common stroke warning signs include sudden face drooping, arm weakness or numbness (especially on one side), slurred speech or difficulty speaking, sudden confusion, vision problems, severe headache, or loss of balance. Remember FAST: Face, Arms, Speech, Time. ' +
          'If you suspect a stroke, call emergency services (911) immediately — every minute matters. Note when symptoms started and do not drive yourself. ' +
          'This is general health education only, not a diagnosis of your situation.'
        );

      case 'health_education':
        if (/diabetes|blood sugar|glucose/.test(q)) {
          return (
            'Common diabetes symptoms can include increased thirst, frequent urination, unexplained weight loss, fatigue, blurred vision, and slow-healing cuts. Some people have no early symptoms. ' +
            'If you are concerned, ask your doctor about screening — especially if you have risk factors. This is general education only, not a diagnosis.'
          );
        }
        if (/flu|influenza|cold/.test(q)) {
          return (
            'Flu symptoms often include fever, cough, sore throat, body aches, fatigue, and headache. Colds are usually milder with more runny nose and less fever. ' +
            'Rest, fluids, and over-the-counter remedies may help mild cases — contact your doctor if symptoms are severe, persistent, or you are in a high-risk group. This is general education only.'
          );
        }
        if (/hypertension|high blood pressure/.test(q)) {
          return (
            'High blood pressure often has no obvious symptoms, which is why it is sometimes called a "silent" condition. Severe cases may cause headaches, shortness of breath, or nosebleeds, but many people feel fine. ' +
            'Regular blood pressure checks are important. Ask your doctor about screening and management. This is general education only.'
          );
        }
        return (
          'Symptoms can vary widely depending on the condition and the individual. For accurate, personalized information, please speak with your doctor or use your clinic\'s patient education resources. ' +
          'If you or someone else is experiencing severe or sudden symptoms, call emergency services (911) or go to the nearest emergency department right away.'
        );

      case 'symptoms':
        return (
          `If you are experiencing new or worsening symptoms, contact your clinic or doctor promptly.${appt} ` +
          'For urgent or emergency symptoms, seek emergency care right away. ' +
          'This assistant provides general information only and cannot evaluate your symptoms.'
        );

      default:
        return (
          `Thanks for your question.${appt} ` +
          'For the most accurate answer about your situation, please contact your clinic directly — staff can give guidance tailored to your visit and medical history. ' +
          'You can call the front desk or message your care team through the clinic app.'
        );
    }
  }

  private async executeChat<T>(
    ctx: AiCallContext,
    cacheInput: string,
    systemPrompt: string,
    userMessage: string,
    transform: (text: string) => T,
  ): Promise<T> {
    const cached = await this.cacheService.get<T>(ctx.endpoint, cacheInput);
    if (cached) {
      this.metricsService.recordCacheHit();
      return cached;
    }
    this.metricsService.recordCacheMiss();

    const release = await this.concurrencyService.acquire();
    const start = Date.now();
    try {
      const result = await this.generateCoreLlm(systemPrompt, userMessage, {
        maxTokens: 700,
        temperature: 0.3,
      });
      const output = transform(result.text);
      const executionTime = Date.now() - start;

      await this.cacheService.set(ctx.endpoint, cacheInput, output);
      await this.requestLogService.log({
        userId: ctx.userId,
        role: ctx.role,
        endpoint: ctx.endpoint,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        executionTime,
      });
      this.metricsService.recordRequest(
        ctx.endpoint,
        result.promptTokens,
        result.completionTokens,
        executionTime,
      );

      return output;
    } catch (err) {
      this.metricsService.recordError();
      this.logger.error(`AI execution failed for ${ctx.endpoint}: ${(err as Error).message}`);
      throw err;
    } finally {
      await release();
    }
  }

  private ensureDoctorDraft(text: string): string {
    if (text.includes('AI-GENERATED DRAFT')) return text;
    return `${DOCTOR_DRAFT_PREFIX}\n\n${text.trim()}`;
  }

  private async execute<T>(
    ctx: AiCallContext,
    cacheInput: string,
    prompt: string,
    transform: (text: string) => T,
  ): Promise<T> {
    const cached = await this.cacheService.get<T>(ctx.endpoint, cacheInput);
    if (cached) {
      this.metricsService.recordCacheHit();
      return cached;
    }
    this.metricsService.recordCacheMiss();

    const release = await this.concurrencyService.acquire();
    const start = Date.now();
    try {
      const result = await this.generateCoreLlm(
        'Follow the user instruction exactly and return only the requested output.',
        prompt,
        {
          maxTokens: 900,
          temperature: 0.3,
        },
      );
      const output = transform(result.text);
      const executionTime = Date.now() - start;

      await this.cacheService.set(ctx.endpoint, cacheInput, output);
      await this.requestLogService.log({
        userId: ctx.userId,
        role: ctx.role,
        endpoint: ctx.endpoint,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        executionTime,
      });
      this.metricsService.recordRequest(
        ctx.endpoint,
        result.promptTokens,
        result.completionTokens,
        executionTime,
      );

      return output;
    } catch (err) {
      this.metricsService.recordError();
      this.logger.error(`AI execution failed for ${ctx.endpoint}: ${(err as Error).message}`);
      throw err;
    } finally {
      await release();
    }
  }

  async generateSummary(text: string, ctx: AiCallContext): Promise<{ summary: string }> {
    const prompt = this.promptService.render('summary', { text });
    return this.execute(ctx, text, prompt, (response) => ({ summary: response.trim() }));
  }

  async generateMedicalReport(
    data: MedicalReportDto,
    ctx: AiCallContext,
  ): Promise<MedicalReportResult> {
    const cacheInput = JSON.stringify(data);
    const prompt = this.promptService.render('medical-report', {
      patientInfo: data.patientInfo || 'Not provided',
      labResults: data.labResults || 'Not provided',
      doctorNotes: data.doctorNotes || 'Not provided',
      diagnoses: data.diagnoses || 'Not provided',
    });

    return this.execute(ctx, cacheInput, prompt, (response) => {
      const parsed = this.parseJsonResponse<MedicalReportResult>(response);
      return {
        summary: parsed.summary || '',
        assessment: this.ensureDoctorDraft(parsed.assessment || ''),
        recommendations: parsed.recommendations || '',
        followUp: parsed.followUp || '',
      };
    });
  }

  async generateAppointmentNote(
    data: AppointmentNoteDto,
    ctx: AiCallContext,
  ): Promise<{ note: string }> {
    const cacheInput = JSON.stringify(data);
    const prompt = this.promptService.render('appointment-note', {
      notes: data.notes,
      context: data.context || 'None',
    });
    return this.execute(ctx, cacheInput, prompt, (response) => ({
      note: this.ensureDoctorDraft(response.trim()),
    }));
  }

  async cleanOCRText(data: OcrCleanupDto, ctx: AiCallContext): Promise<OcrCleanupResult> {
    let rawText = data.rawText?.trim() || '';
    if (!rawText && data.imageBase64) {
      rawText = await this.ocrService.extractTextFromBase64(data.imageBase64);
    }
    if (!rawText) {
      throw new BadRequestException('No text available for OCR cleanup');
    }

    const ocrInput = { rawText, documentType: data.documentType };
    const cacheInput = JSON.stringify(ocrInput);
    const prompt = this.promptService.render('ocr-cleanup', {
      rawText,
      documentType: data.documentType || 'general',
    });

    return this.execute(ctx, cacheInput, prompt, (response) => {
      const parsed = this.parseJsonResponse<{
        cleanedText: string;
        structuredData: Record<string, unknown>;
      }>(response);
      return {
        rawText,
        cleanedText: parsed.cleanedText || rawText,
        structuredData: parsed.structuredData || {},
      };
    });
  }

  async patientAssistant(data: PatientChatDto, ctx: AiCallContext): Promise<{ answer: string }> {
    const resolvedContext = await this.patientContextService.buildContext(ctx.userId, data.context);
    const enrichedData: PatientChatDto = { ...data, context: resolvedContext || data.context };

    const cacheInput = JSON.stringify({
      ...enrichedData,
      _promptVersion: 11,
      _mode: this.patientChatMode,
      _provider: this.resolvePatientLlmProvider(),
    });

    const cached = await this.cacheService.get<{ answer: string }>(ctx.endpoint, cacheInput);
    if (cached) {
      this.metricsService.recordCacheHit();
      return cached;
    }
    this.metricsService.recordCacheMiss();

    const release = await this.concurrencyService.acquire();
    const start = Date.now();
    let promptTokens = 0;
    let completionTokens = 0;
    let answer: string;
    let source: 'deepseek' | 'gemini' | 'template' = 'template';

    try {
    const useTemplateOnly = this.patientChatMode === 'template';
    const useLlm = this.patientChatMode === 'llm' || this.patientChatMode === 'hybrid';

    if (useLlm) {
      try {
        const systemPrompt = this.promptService.load('patient-chat-system');
        const userMessage = [
          `Question: ${enrichedData.question}`,
          enrichedData.context?.trim() ? `Context: ${enrichedData.context.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const result = await this.generatePatientLlmChat(systemPrompt, userMessage);

        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        const llmAnswer = this.ensureDisclaimer(this.cleanPatientAnswer(result.text));

        if (!this.isUselessPatientAnswer(llmAnswer, enrichedData.question)) {
          answer = llmAnswer;
          source = result.provider as 'deepseek' | 'gemini';
        } else if (this.patientChatMode === 'llm') {
          throw new BadRequestException(
            'AI model returned a low-quality response. Please retry or contact your clinic.',
          );
        } else {
          this.logger.warn('Patient chat LLM answer weak — using template fallback');
          answer = this.ensureDisclaimer(this.buildPatientAnswer(enrichedData));
        }
      } catch (err) {
        if (this.patientChatMode === 'llm') {
          this.metricsService.recordError();
          throw err;
        }
        this.logger.warn(`Patient chat LLM failed — using template fallback: ${(err as Error).message}`);
        answer = this.ensureDisclaimer(this.buildPatientAnswer(enrichedData));
      }
    } else {
      answer = this.ensureDisclaimer(this.buildPatientAnswer(enrichedData));
    }

    if (useTemplateOnly) {
      this.logger.log(`Patient chat template: ${this.resolvePatientTopic(enrichedData.question)}`);
    } else {
      this.logger.log(`Patient chat source: ${source}`);
    }

    // Strip any internal identifier (UUID of any version, JWT, endpoint) the
    // model may have echoed before it is cached or returned to the patient.
    const output = { answer: this.outboundSanitizer.sanitizeUserResponse(answer) };
    const executionTime = Date.now() - start;

    await this.cacheService.set(ctx.endpoint, cacheInput, output);
    await this.requestLogService.log({
      userId: ctx.userId,
      role: ctx.role,
      endpoint: ctx.endpoint,
      promptTokens,
      completionTokens,
      executionTime,
    });
    this.metricsService.recordRequest(ctx.endpoint, promptTokens, completionTokens, executionTime);

    return output;
    } finally {
      await release();
    }
  }

  async doctorAssistant(data: DoctorChatDto, ctx: AiCallContext): Promise<{ answer: string }> {
    const cacheInput = JSON.stringify(data);
    const prompt = this.promptService.render('doctor-chat', {
      question: data.question,
      patientContext: data.patientContext || 'None',
    });
    return this.execute(ctx, cacheInput, prompt, (response) => ({
      answer: this.outboundSanitizer.sanitizeUserResponse(this.ensureDoctorDraft(response.trim())),
    }));
  }

  async generateClinicalAssessment(data: string, ctx: AiCallContext): Promise<{ assessment: string }> {
    const prompt = this.promptService.render('clinical-assessment', { data });
    return this.execute(ctx, data, prompt, (response) => ({
      assessment: this.ensureDoctorDraft(response.trim()),
    }));
  }

  async generateRecommendations(data: string, ctx: AiCallContext): Promise<{ recommendations: string }> {
    const prompt = this.promptService.render('recommendations', { data });
    return this.execute(ctx, `rec:${data}`, prompt, (response) => ({
      recommendations: this.ensureDoctorDraft(response.trim()),
    }));
  }
}
