import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { IntegrityService } from '../src/ai/memory/integrity.service';
import { IntegrityMacFailedError } from '../src/ai/memory/memory.errors';

function integrityConfig(overrides: Record<string, string> = {}): ConfigService {
  const currentKey = randomBytes(32).toString('base64');
  const previousKey = randomBytes(32).toString('base64');
  return {
    get: (key: string) => {
      const map: Record<string, string> = {
        MEMORY_INTEGRITY_KEY: currentKey,
        MEMORY_INTEGRITY_KEY_VERSION: '2',
        MEMORY_INTEGRITY_KEY_PREVIOUS: previousKey,
        ...overrides,
      };
      return map[key];
    },
  } as unknown as ConfigService;
}

describe('IntegrityService', () => {
  let integrity: IntegrityService;
  let storedCurrentKey: string;
  let storedPreviousKey: string;

  beforeEach(() => {
    storedCurrentKey = randomBytes(32).toString('base64');
    storedPreviousKey = randomBytes(32).toString('base64');
    integrity = new IntegrityService(
      integrityConfig({
        MEMORY_INTEGRITY_KEY: storedCurrentKey,
        MEMORY_INTEGRITY_KEY_VERSION: '2',
        MEMORY_INTEGRITY_KEY_PREVIOUS: storedPreviousKey,
      }),
    );
  });

  it('MAC verification succeeds', () => {
    const plaintext = 'redacted assistant reply';
    const mac = integrity.computeMac(plaintext);
    expect(mac).toHaveLength(64);
    expect(() => integrity.verifyMac(plaintext, mac)).not.toThrow();
  });

  it('modified plaintext fails verification', () => {
    const mac = integrity.computeMac('original text');
    expect(() => integrity.verifyMac('tampered text', mac)).toThrow(IntegrityMacFailedError);
  });

  it('modified MAC fails verification', () => {
    const mac = integrity.computeMac('original text');
    const tampered = mac.slice(0, -1) + (mac.endsWith('a') ? 'b' : 'a');
    expect(() => integrity.verifyMac('original text', tampered)).toThrow(IntegrityMacFailedError);
  });

  it('emits integrity.mac_failed audit hook on mismatch', () => {
    const events: Array<{ reason: string; threadId?: string; seq?: number }> = [];
    integrity.registerMacFailedHandler((event) => events.push(event));

    const mac = integrity.computeMac('hello');
    expect(() =>
      integrity.verifyMac('world', mac, { threadId: 'thread-1', seq: 9 }),
    ).toThrow(IntegrityMacFailedError);

    expect(events).toEqual([
      { reason: 'integrity.mac_failed', threadId: 'thread-1', seq: 9 },
    ]);
  });

  it('supports rotated integrity key dual-verification', () => {
    const previousOnly = new IntegrityService(
      integrityConfig({
        MEMORY_INTEGRITY_KEY: storedCurrentKey,
        MEMORY_INTEGRITY_KEY_VERSION: '2',
        MEMORY_INTEGRITY_KEY_PREVIOUS: storedPreviousKey,
      }),
    );

    const plaintext = 'message encrypted under prior integrity key';
    const macWithPrevious = createMacWithKey(plaintext, storedPreviousKey);

    expect(() => previousOnly.verifyMac(plaintext, macWithPrevious)).not.toThrow();
  });
});

function createMacWithKey(plaintext: string, base64Key: string): string {
  const { createHmac } = require('crypto') as typeof import('crypto');
  return createHmac('sha256', Buffer.from(base64Key, 'base64')).update(plaintext).digest('hex');
}
