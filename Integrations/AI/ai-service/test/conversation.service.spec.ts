import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { ConversationService } from '../src/ai/memory/conversation.service';
import { ConsentService } from '../src/ai/memory/consent.service';
import { EncryptionService } from '../src/ai/memory/encryption.service';
import { IntegrityService } from '../src/ai/memory/integrity.service';
import { KmsAdapterService } from '../src/ai/memory/kms-adapter.service';
import { LanguageDetectionService } from '../src/ai/memory/language-detection.service';
import { AiConversationThread } from '../src/ai/entities/ai-conversation-thread.entity';
import { AiConversationMessage } from '../src/ai/entities/ai-conversation-message.entity';

function memoryConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    MEMORY_KEK: randomBytes(32).toString('base64'),
    MEMORY_KEK_VERSION: '1',
    MEMORY_KMS_PROVIDER: 'env',
    MEMORY_INTEGRITY_KEY: randomBytes(32).toString('base64'),
    MEMORY_INTEGRITY_KEY_VERSION: '1',
    MEMORY_CONVERSATION_STORAGE: 'true',
    NODE_ENV: 'test',
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

describe('ConversationService', () => {
  let service: ConversationService;
  let consent: jest.Mocked<Pick<ConsentService, 'hasConsent'>>;
  let threads: Map<string, AiConversationThread>;
  let messages: Map<string, AiConversationMessage>;

  const patientId = randomUUID();
  const otherPatientId = randomUUID();

  beforeEach(() => {
    threads = new Map();
    messages = new Map();

    const config = memoryConfig();
    const kms = new KmsAdapterService(config);
    kms.onModuleInit();
    const encryption = new EncryptionService();
    const integrity = new IntegrityService(config);

    consent = {
      hasConsent: jest.fn().mockResolvedValue(true),
    };

    const threadRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        for (const thread of threads.values()) {
          if (
            (where.id === undefined || thread.id === where.id) &&
            thread.patientId === where.patientId &&
            (where.channel === undefined || thread.channel === where.channel) &&
            (where.status === undefined || thread.status === where.status)
          ) {
            return { ...thread };
          }
        }
        return null;
      }),
      create: jest.fn((data: Partial<AiConversationThread>) => ({
        id: randomUUID(),
        createdAt: new Date(),
        ...data,
      })) as any,
      save: jest.fn(async (thread: AiConversationThread) => {
        threads.set(thread.id, { ...thread });
        return thread;
      }),
    };

    const messageRepo = {
      create: jest.fn((data: Partial<AiConversationMessage>) => ({
        id: randomUUID(),
        createdAt: new Date(),
        ...data,
      })) as any,
      save: jest.fn(async (message: AiConversationMessage) => {
        messages.set(message.id, { ...message });
        return message;
      }),
      find: jest.fn(async ({ where, order }: any) => {
        const rows = [...messages.values()].filter(
          (m) => m.patientId === where.patientId && m.threadId === where.threadId,
        );
        return rows.sort((a, b) => a.seq - b.seq);
      }),
      findOne: jest.fn(async ({ where }: any) => {
        for (const message of messages.values()) {
          if (message.id === where.id && message.patientId === where.patientId) {
            return { ...message };
          }
        }
        return null;
      }),
    };

    const languageDetection = new LanguageDetectionService();

    service = new ConversationService(
      threadRepo as any,
      messageRepo as any,
      { create: jest.fn(), save: jest.fn() } as any,
      config,
      consent as unknown as ConsentService,
      kms,
      encryption,
      integrity,
      languageDetection,
    );
  });

  it('creates thread with wrapped DEK on first use', async () => {
    const thread = await service.getOrCreateActiveThread(patientId, 'booking');
    expect(thread.wrappedDek).toBeDefined();
    expect(thread.wrappedDek.length).toBeGreaterThan(32);
    expect(thread.dekKeyVersion).toBe(1);
    expect(thread.patientId).toBe(patientId);
  });

  it('appends encrypted message and decrypts with MAC verification', async () => {
    const saved = await service.appendMessage(patientId, 'booking', {
      role: 'user',
      plaintext: 'Find cardiology clinics in Damascus',
      detectedLang: 'en',
      redactionFlags: { uuid_stripped: true },
    });

    const decrypted = await service.decryptMessage(patientId, saved.id);
    expect(decrypted.plaintext).toBe('Find cardiology clinics in Damascus');
    expect(decrypted.seq).toBe(1);
  });

  it('rejects append when conversation_storage consent is missing', async () => {
    consent.hasConsent.mockResolvedValue(false);
    await expect(
      service.appendMessage(patientId, 'booking', {
        role: 'user',
        plaintext: 'hello',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects append when MEMORY_CONVERSATION_STORAGE is disabled', async () => {
    const config = memoryConfig({ MEMORY_CONVERSATION_STORAGE: 'false' });
    const kms = new KmsAdapterService(config);
    const encryption = new EncryptionService();
    const integrity = new IntegrityService(config);
    const disabledService = new ConversationService(
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } as any,
      { create: jest.fn(), save: jest.fn() } as any,
      { create: jest.fn(), save: jest.fn() } as any,
      config,
      consent as unknown as ConsentService,
      kms,
      encryption,
      integrity,
      new LanguageDetectionService(),
    );

    await expect(
      disabledService.appendMessage(patientId, 'booking', {
        role: 'user',
        plaintext: 'hello',
      }),
    ).rejects.toThrow(/Conversation storage is disabled/);
  });

  it('scopes decrypt to patient_id', async () => {
    const saved = await service.appendMessage(patientId, 'booking', {
      role: 'user',
      plaintext: 'private',
    });

    await expect(service.decryptMessage(otherPatientId, saved.id)).rejects.toThrow(
      /Message not found/,
    );
  });

  it('auto-detects language when detectedLang is omitted', async () => {
    const saved = await service.appendMessage(patientId, 'booking', {
      role: 'user',
      plaintext: 'أريد حجز موعد في عيادة القلب صباحاً',
    });

    expect(saved.detectedLang).toBe('ar');
  });

  it('increments seq per thread', async () => {
    await service.appendMessage(patientId, 'booking', {
      role: 'user',
      plaintext: 'first',
    });
    const second = await service.appendMessage(patientId, 'booking', {
      role: 'assistant',
      plaintext: 'second',
    });
    expect(second.seq).toBe(2);
  });
});
