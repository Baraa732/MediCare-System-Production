/**
 * @jest-environment node
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AiModule } from '../src/ai/ai.module';
import { GeminiService } from '../src/ai/services/gemini.service';
import { DeepSeekService } from '../src/ai/services/deepseek.service';
import { AiCacheService } from '../src/ai/services/ai-cache.service';
import { AiRateLimitService } from '../src/ai/services/ai-rate-limit.service';
import { AiRequestLogService } from '../src/ai/services/ai-request-log.service';
import { OcrService } from '../src/ai/services/ocr.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiRequest } from '../src/ai/entities/ai-request.entity';
import * as http from 'http';

describe('AiController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let port: number;

  const mockGemini = {
    isConfigured: jest.fn().mockReturnValue(true),
    ensureAvailable: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({
      configured: true,
      reachable: true,
      model: 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      message: 'ready',
    }),
    checkHealth: jest.fn().mockResolvedValue({
      configured: true,
      reachable: true,
      model: 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      message: 'ready',
    }),
    generateChat: jest.fn().mockImplementation(async () => ({
      text: '[AI-GENERATED DRAFT — Requires physician review]\n\nClinical summary text.\n\nDisclaimer: This is general health information only, not medical advice. Please consult your healthcare provider for personal medical decisions.',
      promptTokens: 10,
      completionTokens: 5,
    })),
  };

  const mockDeepSeek = {
    isConfigured: jest.fn().mockReturnValue(false),
    ensureAvailable: jest.fn().mockResolvedValue(false),
    checkHealth: jest.fn().mockResolvedValue({
      configured: false,
      reachable: false,
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      message: 'not configured',
    }),
    getStatus: jest.fn().mockReturnValue({
      configured: false,
      reachable: false,
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      message: 'not configured',
    }),
    generateChat: jest.fn(),
  };

  function token(role: string) {
    return jwtService.sign(
      { sub: 'test-user-id', role, phoneNumber: '+1234567890' },
      { secret: 'test-jwt-secret-for-integration-tests-only', algorithm: 'HS256' },
    );
  }

  async function post(path: string, role: string, body: unknown): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token(role)}`,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
        },
      );
      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests-only';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-service-token-min-24-chars';

    mockGemini.generateChat.mockImplementation(async () => ({
      text: JSON.stringify({
        summary: 'Overview',
        assessment: 'Draft',
        recommendations: 'Rest',
        followUp: '2 weeks',
        cleanedText: 'Clean text',
        structuredData: { documentType: 'lab_report' },
      }),
      promptTokens: 10,
      completionTokens: 5,
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AiModule],
    })
      .overrideProvider(GeminiService)
      .useValue(mockGemini)
      .overrideProvider(DeepSeekService)
      .useValue(mockDeepSeek)
      .overrideProvider(AiCacheService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        ping: jest.fn().mockResolvedValue(true),
      })
      .overrideProvider(AiRateLimitService)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn(), check: jest.fn() })
      .overrideProvider(AiRequestLogService)
      .useValue({ log: jest.fn() })
      .overrideProvider(OcrService)
      .useValue({
        extractTextFromBase64: jest.fn().mockResolvedValue('OCR extracted text'),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(getRepositoryToken(AiRequest))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/ai/summary — secretary allowed', async () => {
    mockGemini.generateChat.mockResolvedValueOnce({
      text: 'Summary text',
      promptTokens: 10,
      completionTokens: 5,
    });
    const response = await post('/v1/ai/summary', 'SECRETARY', {
      text: 'Patient visit notes for summary',
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).summary).toBeDefined();
  });

  it('POST /v1/ai/report — doctor allowed', async () => {
    const response = await post('/v1/ai/report', 'DOCTOR', { patientInfo: 'Test patient' });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).summary).toBe('Overview');
  });

  it('POST /v1/ai/ocr-cleanup — with rawText', async () => {
    const response = await post('/v1/ai/ocr-cleanup', 'SECRETARY', {
      rawText: 'HbA1c: 6.2%',
      documentType: 'lab_report',
    });
    expect(response.status).toBe(201);
    const parsed = JSON.parse(response.body);
    expect(parsed.cleanedText).toBeDefined();
    expect(parsed.structuredData).toBeDefined();
  });

  it('POST /v1/ai/patient-chat — includes disclaimer', async () => {
    mockGemini.generateChat.mockResolvedValueOnce({
      text: 'General health information response.',
      promptTokens: 10,
      completionTokens: 5,
    });
    const response = await post('/v1/ai/patient-chat', 'PATIENT', {
      question: 'How do I prepare for a blood test?',
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).answer).toContain('Disclaimer:');
  });

  it('POST /v1/ai/doctor-chat — doctor allowed', async () => {
    mockGemini.generateChat.mockResolvedValueOnce({
      text: 'Draft documentation.',
      promptTokens: 10,
      completionTokens: 5,
    });
    const response = await post('/v1/ai/doctor-chat', 'DOCTOR', {
      question: 'Summarize history',
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).answer).toContain('AI-GENERATED DRAFT');
  });

  it('POST /v1/ai/appointment-note', async () => {
    mockGemini.generateChat.mockResolvedValueOnce({
      text: 'Professional note content.',
      promptTokens: 10,
      completionTokens: 5,
    });
    const response = await post('/v1/ai/appointment-note', 'DOCTOR', {
      notes: 'Pt c/o headache',
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).note).toBeDefined();
  });

  it('POST /v1/ai/report — secretary forbidden', async () => {
    const response = await post('/v1/ai/report', 'SECRETARY', { patientInfo: 'Test' });
    expect(response.status).toBe(403);
  });

  it('POST /v1/ai/patient-chat — doctor forbidden', async () => {
    const response = await post('/v1/ai/patient-chat', 'DOCTOR', { question: 'test' });
    expect(response.status).toBe(403);
  });
});
