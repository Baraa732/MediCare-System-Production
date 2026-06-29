import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { AiService } from '../src/ai/services/ai.service';
import { OutboundSanitizerService } from '../src/ai/security/outbound-sanitizer.service';
import { OutboundResponseInterceptor } from '../src/ai/interceptors/outbound-response.interceptor';

const ANY_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

const INCIDENT_UUID = 'a3d6d4b7-1edf-4476-a25f-c7f4f70df833';
const UUID_V7 = '01890a5d-ac96-774b-bcce-b302099a8057';

// The exact text reported in the incident, plus padding to clear the
// "useless answer" quality gate so the LLM answer is actually used.
const leakyAnswer = (uuid: string) =>
  `I've fetched the list of doctors from Damascus Heart Clinic (ID: ${uuid}). ` +
  'There are three cardiologists currently accepting new patients this week. ' +
  'Would you like me to provide that information?';

function buildAiService(llmText: string): { service: AiService; generate: jest.Mock } {
  const generate = jest.fn().mockResolvedValue({
    text: llmText,
    promptTokens: 10,
    completionTokens: 10,
  });

  const deepSeek = { isConfigured: () => true, generateChat: generate } as any;
  const gemini = { isConfigured: () => false, generateChat: jest.fn() } as any;
  const prompt = { load: () => 'system', render: () => 'prompt' } as any;
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as any;
  const requestLog = { log: jest.fn() } as any;
  const metrics = {
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordRequest: jest.fn(),
    recordError: jest.fn(),
  } as any;
  const ocr = { extractTextFromBase64: jest.fn() } as any;
  const patientContext = { buildContext: jest.fn().mockResolvedValue('') } as any;
  const config = {
    get: (key: string) => {
      if (key === 'PATIENT_CHAT_MODE') return 'llm';
      if (key === 'PATIENT_CHAT_PROVIDER') return 'deepseek';
      return undefined;
    },
  } as unknown as ConfigService;
  const outbound = new OutboundSanitizerService();

  const service = new AiService(
    deepSeek,
    gemini,
    prompt,
    cache,
    requestLog,
    metrics,
    ocr,
    patientContext,
    config,
    outbound,
  );

  return { service, generate };
}

describe('Patient-chat internal UUID leak regression', () => {
  const ctx = { userId: 'patient-1', role: 'PATIENT', endpoint: 'patient-chat' };

  it('strips a clinic UUID echoed by the model (the production incident)', async () => {
    const { service } = buildAiService(leakyAnswer(INCIDENT_UUID));

    const { answer } = await service.patientAssistant(
      { question: "who's the doctors that work in damascus heart clinic?" } as any,
      ctx,
    );

    expect(answer).not.toContain(INCIDENT_UUID);
    expect(answer).not.toMatch(ANY_UUID);
    expect(answer).toContain('Damascus Heart Clinic');
  });

  it('strips a UUIDv7 the legacy strict redactor would miss', async () => {
    const { service } = buildAiService(leakyAnswer(UUID_V7));

    const { answer } = await service.patientAssistant(
      { question: "who's the doctors that work in damascus heart clinic?" } as any,
      ctx,
    );

    expect(answer).not.toContain(UUID_V7);
    expect(answer).not.toMatch(ANY_UUID);
  });

  it('does not cache an unsanitized answer', async () => {
    const { service } = buildAiService(leakyAnswer(INCIDENT_UUID));
    const cacheSet = jest.fn();
    (service as any).cacheService.set = cacheSet;

    await service.patientAssistant(
      { question: "who's the doctors that work in damascus heart clinic?" } as any,
      ctx,
    );

    expect(cacheSet).toHaveBeenCalled();
    const cachedValue = JSON.stringify(cacheSet.mock.calls[0][2]);
    expect(cachedValue).not.toMatch(ANY_UUID);
  });

  it('removes raw tool-call text from model output', async () => {
    const { service } = buildAiService(
      `I have retrieved the list of doctors for you. They are [list_doctors('${INCIDENT_UUID}')].`,
    );

    const { answer } = await service.patientAssistant(
      { question: "who's the doctors that work in damascus heart clinic?" } as any,
      ctx,
    );

    expect(answer).not.toContain('list_doctors(');
    expect(answer).not.toContain(INCIDENT_UUID);
    expect(answer).not.toMatch(ANY_UUID);
  });
});

describe('OutboundResponseInterceptor (boundary defense)', () => {
  const interceptor = new OutboundResponseInterceptor(new OutboundSanitizerService());
  const ctx = {} as any;

  function run(payload: unknown): Promise<unknown> {
    return new Promise((resolve) => {
      interceptor
        .intercept(ctx, { handle: () => of(payload) })
        .subscribe((v) => resolve(v));
    });
  }

  it('sanitizes the answer field (covers cache-hit responses too)', async () => {
    const out = (await run({ answer: leakyAnswer(INCIDENT_UUID) })) as { answer: string };
    expect(out.answer).not.toMatch(ANY_UUID);
  });

  it('sanitizes the reply field', async () => {
    const out = (await run({ reply: `Clinic ${UUID_V7}` })) as { reply: string };
    expect(out.reply).not.toMatch(ANY_UUID);
  });

  it('passes through clean payloads unchanged', async () => {
    const out = (await run({ answer: 'Bring your ID and arrive 10 minutes early.' })) as {
      answer: string;
    };
    expect(out.answer).toBe('Bring your ID and arrive 10 minutes early.');
  });
});
