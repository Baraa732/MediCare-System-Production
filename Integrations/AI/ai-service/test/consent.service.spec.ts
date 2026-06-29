import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ConsentService } from '../src/ai/memory/consent.service';
import { MemoryAuditService } from '../src/ai/memory/memory-audit.service';
import { AiPatientConsent } from '../src/ai/entities/ai-patient-consent.entity';

describe('ConsentService', () => {
  let service: ConsentService;
  let rows: AiPatientConsent[];
  let auditCalls: Array<Record<string, unknown>>;

  const patientId = randomUUID();

  beforeEach(() => {
    rows = [];
    auditCalls = [];

    const consentRepo = {
      create: jest.fn((data: Partial<AiPatientConsent>) => ({
        id: randomUUID(),
        grantedAt: new Date(),
        ...data,
      })),
      save: jest.fn(async (row: AiPatientConsent) => {
        const idx = rows.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          rows[idx] = { ...row };
          return rows[idx];
        }
        rows.push({ ...row });
        return row;
      }),
      findOne: jest.fn(async ({ where }: any) => {
        const matches = rows.filter((row) => {
          if (row.patientId !== where.patientId) return false;
          if (row.scope !== where.scope) return false;
          if (row.granted !== where.granted) return false;
          const wantsNullRevoked =
            where.revokedAt &&
            typeof where.revokedAt === 'object' &&
            (where.revokedAt._type === 'isNull' || where.revokedAt.type === 'isNull');
          if (wantsNullRevoked) return row.revokedAt == null;
          return row.revokedAt === where.revokedAt;
        });
        matches.sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
        return matches[0] || null;
      }),
    };

    const audit = {
      append: jest.fn(async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      }),
    };

    service = new ConsentService(
      consentRepo as any,
      { get: () => '1.0' } as unknown as ConfigService,
      audit as unknown as MemoryAuditService,
    );
  });

  it('grants consent and records audit event', async () => {
    await service.grantConsent(patientId, 'conversation_storage');
    expect(await service.hasConsent(patientId, 'conversation_storage')).toBe(true);
    expect(auditCalls.some((c) => c.action === 'consent.grant')).toBe(true);
  });

  it('revokes consent and stops hasConsent immediately', async () => {
    await service.grantConsent(patientId, 'preference_memory');
    expect(await service.hasConsent(patientId, 'preference_memory')).toBe(true);

    await service.revokeConsent(patientId, 'preference_memory');
    expect(await service.hasConsent(patientId, 'preference_memory')).toBe(false);
    expect(auditCalls.some((c) => c.action === 'consent.revoke')).toBe(true);
  });

  it('tracks scopes independently', async () => {
    await service.grantConsent(patientId, 'conversation_storage');
    await service.grantConsent(patientId, 'summarization');

    expect(await service.hasConsent(patientId, 'conversation_storage')).toBe(true);
    expect(await service.hasConsent(patientId, 'summarization')).toBe(true);
    expect(await service.hasConsent(patientId, 'clinical_memory')).toBe(false);
  });

  it('returns false when no grant exists', async () => {
    expect(await service.hasConsent(patientId, 'conversation_storage')).toBe(false);
  });
});

describe('MemoryAuditService integrity hook', () => {
  it('registers integrity.mac_failed handler on init', async () => {
    const saved: Array<Record<string, unknown>> = [];
    const auditRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (row) => {
        saved.push(row);
        return row;
      }),
    };

    const integrity = new (await import('../src/ai/memory/integrity.service')).IntegrityService({
      get: (key: string) => {
        if (key === 'MEMORY_INTEGRITY_KEY') {
          return Buffer.alloc(32, 7).toString('base64');
        }
        if (key === 'MEMORY_INTEGRITY_KEY_VERSION') return '1';
        return undefined;
      },
    } as any);

    const auditService = new MemoryAuditService(auditRepo as any, integrity);
    auditService.onModuleInit();

    const { IntegrityMacFailedError } = await import('../src/ai/memory/memory.errors');
    expect(() =>
      integrity.verifyMac('tampered', integrity.computeMac('original'), {
        threadId: 'thread-abc',
        seq: 3,
      }),
    ).toThrow(IntegrityMacFailedError);

    await new Promise((r) => setTimeout(r, 10));
    expect(saved.some((row) => row.action === 'integrity.mac_failed')).toBe(true);
  });
});
