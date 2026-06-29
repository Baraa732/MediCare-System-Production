import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiService } from '../src/ai/services/ai.service';
import { PromptService } from '../src/ai/services/prompt.service';
import { AiCacheService } from '../src/ai/services/ai-cache.service';
import { AiRequestLogService } from '../src/ai/services/ai-request-log.service';
import { AiMetricsService } from '../src/ai/services/ai-metrics.service';
import { ConfigService } from '@nestjs/config';
import { OcrService } from '../src/ai/services/ocr.service';

import { DeepSeekService } from '../src/ai/services/deepseek.service';
import { GeminiService } from '../src/ai/services/gemini.service';
import { PatientContextService } from '../src/ai/services/patient-context.service';
import { OutboundSanitizerService } from '../src/ai/security/outbound-sanitizer.service';

describe('AiService', () => {
  let service: AiService;
  let deepSeekService: {
    isConfigured: jest.Mock;
    generateChat: jest.Mock;
  };
  let geminiService: {
    isConfigured: jest.Mock;
    generateChat: jest.Mock;
  };

  const ctx = { userId: 'user-1', role: 'DOCTOR', endpoint: 'summary' };

  const createModule = (patientChatMode = 'template', patientProvider = 'gemini') =>
    Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: DeepSeekService,
          useValue: deepSeekService,
        },
        {
          provide: GeminiService,
          useValue: geminiService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PATIENT_CHAT_MODE') return patientChatMode;
              if (key === 'PATIENT_CHAT_PROVIDER') return patientProvider;
              if (key === 'AI_PROVIDER') return 'gemini';
              return undefined;
            }),
          },
        },
        {
          provide: PromptService,
          useValue: {
            load: jest.fn(() => 'system prompt'),
            render: jest.fn((_name: string, vars: Record<string, string>) =>
              `prompt:${vars.text || vars.question || vars.notes || vars.rawText || vars.data}`,
            ),
          },
        },
        {
          provide: AiCacheService,
          useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn() },
        },
        {
          provide: AiRequestLogService,
          useValue: { log: jest.fn() },
        },
        AiMetricsService,
        {
          provide: OcrService,
          useValue: { extractTextFromBase64: jest.fn(), onModuleDestroy: jest.fn() },
        },
        {
          provide: PatientContextService,
          useValue: { buildContext: jest.fn().mockResolvedValue('') },
        },
        OutboundSanitizerService,
      ],
    }).compile();

  beforeEach(async () => {
    deepSeekService = {
      isConfigured: jest.fn().mockReturnValue(false),
      generateChat: jest.fn().mockResolvedValue({
        text: 'DeepSeek: drink water only before your lab test unless told otherwise.',
        promptTokens: 60,
        completionTokens: 35,
      }),
    };

    geminiService = {
      isConfigured: jest.fn().mockReturnValue(false),
      generateChat: jest.fn().mockResolvedValue({
        text: 'Gemini: drink water only before your lab test unless told otherwise.',
        promptTokens: 55,
        completionTokens: 30,
      }),
    };

    const module = await createModule('template');
    service = module.get(AiService);
  });

  it('generateSummary returns summary text', async () => {
    const result = await service.generateSummary('Some clinical notes', ctx);
    expect(result.summary).toContain('Gemini:');
    expect(geminiService.generateChat).toHaveBeenCalled();
  });

  it('patientAssistant uses template for blood test questions', async () => {
    const result = await service.patientAssistant(
      { question: 'How do I prepare for a blood test?', context: 'Appointment Monday 9 AM' },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(geminiService.generateChat).not.toHaveBeenCalled();
    expect(result.answer.toLowerCase()).toContain('blood');
    expect(result.answer.toLowerCase()).toContain('fasting');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant uses drink template for coffee questions', async () => {
    const result = await service.patientAssistant(
      { question: 'Can I drink coffee before my visit?', context: 'Appointment Monday 9 AM' },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(geminiService.generateChat).not.toHaveBeenCalled();
    expect(result.answer.toLowerCase()).toContain('coffee');
    expect(result.answer).not.toContain('For specific guidance on this topic');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant answers procedure duration for blood and glucose tests', async () => {
    const result = await service.patientAssistant(
      {
        question:
          'I would like to come to the clinic for blood and glucose tests, How long will the procedure take, approximately?',
        context: 'Appointment Monday 9 AM',
      },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(result.answer.toLowerCase()).toContain('15');
    expect(result.answer.toLowerCase()).toContain('minute');
    expect(result.answer.toLowerCase()).toContain('glucose');
    expect(result.answer).not.toContain('fast for 8');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant explains heart attack symptoms and emergency steps', async () => {
    const result = await service.patientAssistant(
      {
        question:
          'What are the common symptoms of a heart attack, and what should you do if you suspect one is occurring?',
        context: 'Appointment Monday 9 AM',
      },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(result.answer.toLowerCase()).toContain('chest');
    expect(result.answer).toContain('911');
    expect(result.answer).not.toContain('Your appointment is Monday');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant uses DeepSeek in hybrid mode when configured', async () => {
    deepSeekService.isConfigured.mockReturnValue(true);
    const module = await createModule('hybrid', 'auto');
    const hybridService = module.get(AiService);

    const result = await hybridService.patientAssistant(
      { question: 'Can I drink coffee before my visit?', context: 'Appointment Monday 9 AM' },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(deepSeekService.generateChat).toHaveBeenCalled();
    expect(geminiService.generateChat).not.toHaveBeenCalled();
    expect(result.answer.toLowerCase()).toContain('deepseek');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant uses Gemini when provider is gemini', async () => {
    geminiService.isConfigured.mockReturnValue(true);
    const module = await createModule('hybrid', 'gemini');
    const hybridService = module.get(AiService);

    const result = await hybridService.patientAssistant(
      { question: 'Can I drink coffee before my visit?', context: 'Appointment Monday 9 AM' },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(geminiService.generateChat).toHaveBeenCalled();
    expect(deepSeekService.generateChat).not.toHaveBeenCalled();
    expect(result.answer.toLowerCase()).toContain('gemini');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant uses LLM in hybrid mode when model responds well', async () => {
    const module = await createModule('hybrid');
    const hybridService = module.get(AiService);

    const result = await hybridService.patientAssistant(
      { question: 'Can I drink coffee before my visit?', context: 'Appointment Monday 9 AM' },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(geminiService.generateChat).toHaveBeenCalled();
    expect(result.answer.toLowerCase()).toContain('drink water');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('patientAssistant uses morning template for timing questions', async () => {
    const result = await service.patientAssistant(
      { question: 'the blood test should be at the morning ?', context: 'Appointment Monday 9 AM' },
      { ...ctx, endpoint: 'patient-chat', role: 'PATIENT' },
    );

    expect(geminiService.generateChat).not.toHaveBeenCalled();
    expect(result.answer.toLowerCase()).toContain('morning');
    expect(result.answer).not.toContain('The patient might');
    expect(result.answer).toContain('Disclaimer:');
  });

  it('doctorAssistant prepends draft prefix', async () => {
    const result = await service.doctorAssistant(
      { question: 'Summarize history' },
      { ...ctx, endpoint: 'doctor-chat' },
    );
    expect(result.answer).toContain('AI-GENERATED DRAFT');
  });

  it('generateMedicalReport parses JSON response', async () => {
    geminiService.generateChat.mockResolvedValueOnce({
      text: JSON.stringify({
        summary: 'Overview',
        assessment: 'Draft assessment',
        recommendations: 'Rest and fluids',
        followUp: 'Return in 2 weeks',
      }),
      promptTokens: 200,
      completionTokens: 100,
    });

    const result = await service.generateMedicalReport(
      { patientInfo: 'John Doe, 45M', diagnoses: 'Hypertension' },
      { ...ctx, endpoint: 'report' },
    );

    expect(result.summary).toBe('Overview');
    expect(result.assessment).toContain('AI-GENERATED DRAFT');
    expect(result.followUp).toBe('Return in 2 weeks');
  });

  it('cleanOCRText returns structured pipeline output', async () => {
    geminiService.generateChat.mockResolvedValueOnce({
      text: JSON.stringify({
        cleanedText: 'HbA1c: 6.2%',
        structuredData: { documentType: 'lab_report', patientName: 'Jane' },
      }),
      promptTokens: 150,
      completionTokens: 80,
    });

    const result = await service.cleanOCRText(
      { rawText: 'HbA1c: 6.2%0', documentType: 'lab_report' },
      { ...ctx, endpoint: 'ocr-cleanup', role: 'SECRETARY' },
    );

    expect(result.rawText).toBe('HbA1c: 6.2%0');
    expect(result.cleanedText).toBe('HbA1c: 6.2%');
    expect(result.structuredData).toEqual(
      expect.objectContaining({ documentType: 'lab_report' }),
    );
  });

  it('throws BadRequestException on invalid JSON from model', async () => {
    geminiService.generateChat.mockResolvedValueOnce({
      text: 'not valid json at all',
      promptTokens: 50,
      completionTokens: 10,
    });

    await expect(
      service.cleanOCRText({ rawText: 'test' }, { ...ctx, endpoint: 'ocr-cleanup' }),
    ).rejects.toThrow(BadRequestException);
  });
});
