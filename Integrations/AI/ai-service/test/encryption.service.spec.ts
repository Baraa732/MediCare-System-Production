import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { EncryptionService } from '../src/ai/memory/encryption.service';
import { KmsAdapterService } from '../src/ai/memory/kms-adapter.service';

function testConfig(overrides: Record<string, string> = {}): ConfigService {
  const kek = randomBytes(32).toString('base64');
  const map: Record<string, string> = {
    MEMORY_KEK: kek,
    MEMORY_KEK_VERSION: '1',
    MEMORY_KMS_PROVIDER: 'env',
    NODE_ENV: 'test',
    MEMORY_CONVERSATION_STORAGE: 'false',
    ...overrides,
  };
  return {
    get: (key: string) => map[key],
    getOrThrow: (key: string) => {
      if (!map[key]) throw new Error(`Missing config: ${key}`);
      return map[key];
    },
  } as unknown as ConfigService;
}

describe('EncryptionService', () => {
  let encryption: EncryptionService;
  let kms: KmsAdapterService;

  const threadId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const otherThreadId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  beforeEach(() => {
    encryption = new EncryptionService();
    kms = new KmsAdapterService(testConfig());
    kms.onModuleInit();
  });

  it('encrypt/decrypt round trip succeeds', async () => {
    const dek = encryption.generateDek();
    const ctx = { threadId, seq: 42, keyVersion: 3 };
    const plaintext = 'Hello, redacted patient message';

    const encrypted = encryption.encryptMessage(plaintext, dek, ctx);
    const decrypted = encryption.decryptMessage(encrypted.ciphertext, encrypted.nonce, dek, ctx);

    expect(decrypted).toBe(plaintext);
    expect(encryption.buildAad(ctx).toString('utf8')).toBe(`${threadId}:42:3`);
  });

  it('ciphertext copied to another thread fails decryption', async () => {
    const dek = encryption.generateDek();
    const encrypted = encryption.encryptMessage('secret', dek, {
      threadId,
      seq: 1,
      keyVersion: 1,
    });

    expect(() =>
      encryption.decryptMessage(encrypted.ciphertext, encrypted.nonce, dek, {
        threadId: otherThreadId,
        seq: 1,
        keyVersion: 1,
      }),
    ).toThrow(/AES-GCM decryption failed/);
  });

  it('modified seq fails decryption', async () => {
    const dek = encryption.generateDek();
    const encrypted = encryption.encryptMessage('secret', dek, {
      threadId,
      seq: 5,
      keyVersion: 1,
    });

    expect(() =>
      encryption.decryptMessage(encrypted.ciphertext, encrypted.nonce, dek, {
        threadId,
        seq: 6,
        keyVersion: 1,
      }),
    ).toThrow(/AES-GCM decryption failed/);
  });

  it('modified key_version fails decryption', async () => {
    const dek = encryption.generateDek();
    const encrypted = encryption.encryptMessage('secret', dek, {
      threadId,
      seq: 5,
      keyVersion: 2,
    });

    expect(() =>
      encryption.decryptMessage(encrypted.ciphertext, encrypted.nonce, dek, {
        threadId,
        seq: 5,
        keyVersion: 3,
      }),
    ).toThrow(/AES-GCM decryption failed/);
  });

  it('modified nonce fails decryption', async () => {
    const dek = encryption.generateDek();
    const encrypted = encryption.encryptMessage('secret', dek, {
      threadId,
      seq: 1,
      keyVersion: 1,
    });
    const tamperedNonce = Buffer.from(encrypted.nonce);
    tamperedNonce[0] ^= 0xff;

    expect(() =>
      encryption.decryptMessage(encrypted.ciphertext, tamperedNonce, dek, {
        threadId,
        seq: 1,
        keyVersion: 1,
      }),
    ).toThrow(/AES-GCM decryption failed/);
  });

  it('per-thread DEK isolation verified', async () => {
    const dek1 = encryption.generateDek();
    const dek2 = encryption.generateDek();
    const ctx = { threadId, seq: 1, keyVersion: 1 };

    const encrypted = encryption.encryptMessage('thread-one-secret', dek1, ctx);

    expect(() =>
      encryption.decryptMessage(encrypted.ciphertext, encrypted.nonce, dek2, ctx),
    ).toThrow(/AES-GCM decryption failed/);
  });

  it('wraps and unwraps DEK without exposing plaintext in storage shape', async () => {
    const dek = encryption.generateDek();
    const { wrappedDek, keyVersion } = await kms.wrapKey(dek);
    const unwrapped = await kms.unwrapKey(wrappedDek, keyVersion);

    expect(wrappedDek.equals(dek)).toBe(false);
    expect(unwrapped.equals(dek)).toBe(true);
  });
});

describe('KmsAdapterService production gate', () => {
  it('throws when conversation storage enabled in production without KMS key', () => {
    const kms = new KmsAdapterService(
      testConfig({
        NODE_ENV: 'production',
        MEMORY_CONVERSATION_STORAGE: 'true',
        MEMORY_KMS_KEY_ID: '',
      }),
    );

    expect(() => kms.onModuleInit()).toThrow(/MEMORY_KMS_KEY_ID is required/);
  });
});
