import { ConfigService } from '@nestjs/config';
import { ReferenceResolverService } from '../src/ai/security/references/reference-resolver.service';
import { ReferenceStore } from '../src/ai/security/references/reference.types';

describe('ReferenceResolverService', () => {
  let resolver: ReferenceResolverService;
  const stores = new Map<string, string>();

  beforeEach(() => {
    stores.clear();
    const config = { getOrThrow: () => 'redis://localhost:6379' } as unknown as ConfigService;
    resolver = new ReferenceResolverService(config);
    (resolver as any).redis = {
      get: jest.fn(async (key: string) => stores.get(key) || null),
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        stores.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        stores.delete(key);
      }),
    };
  });

  it('allocates opaque refs matching CLN|DOC|SLT|APT pattern', async () => {
    await resolver.initStore('patient-a', 'session-1');
    const ref = await resolver.allocate('patient-a', 'session-1', 'clinic', 'uuid-clinic-1', {
      name: 'Heart Clinic',
    });
    expect(ref).toMatch(/^(CLN|DOC|SLT|APT)-[A-Z0-9]{4}$/);
    expect(ref.startsWith('CLN-')).toBe(true);
  });

  it('rejects UUID strings as refs', () => {
    expect(() =>
      resolver.assertRefFormat('550e8400-e29b-41d4-a716-446655440000'),
    ).toThrow('uuid_not_allowed');
  });

  it('isolates refs per patient session namespace', async () => {
    await resolver.initStore('patient-a', 's1');
    await resolver.initStore('patient-b', 's1');
    const ref = await resolver.allocate('patient-a', 's1', 'clinic', 'c1');
    await expect(resolver.resolve('patient-b', 's1', ref, 'clinic')).rejects.toThrow(
      'unknown_reference',
    );
  });

  it('marks slot ref consumed and blocks replay', async () => {
    await resolver.initStore('patient-a', 's1');
    const slotRef = await resolver.allocate('patient-a', 's1', 'slot', 'slot-1');
    await resolver.markConsumed('patient-a', 's1', slotRef);
    await expect(resolver.resolve('patient-a', 's1', slotRef, 'slot')).rejects.toThrow(
      'reference_consumed',
    );
  });

  it('allows clinic ref reuse after slot consumption', async () => {
    await resolver.initStore('patient-a', 's1');
    const clinicRef = await resolver.allocate('patient-a', 's1', 'clinic', 'c1');
    const slotRef = await resolver.allocate('patient-a', 's1', 'slot', 's1', {}, clinicRef);
    await resolver.markConsumed('patient-a', 's1', slotRef);
    const entry = await resolver.resolve('patient-a', 's1', clinicRef, 'clinic');
    expect(entry.id).toBe('c1');
  });

  it('invalidates appointment ref after cancellation consume', async () => {
    await resolver.initStore('patient-a', 's1');
    const aptRef = await resolver.allocate('patient-a', 's1', 'appointment', 'appt-1');
    await resolver.markConsumed('patient-a', 's1', aptRef);
    await expect(resolver.resolve('patient-a', 's1', aptRef, 'appointment')).rejects.toThrow(
      'reference_consumed',
    );
  });

  it('expires with missing store', async () => {
    await expect(resolver.resolve('patient-a', 'missing', 'CLN-ABCD', 'clinic')).rejects.toThrow(
      'expired_reference',
    );
  });

  it('persists consumedAt timestamp', async () => {
    await resolver.initStore('patient-a', 's1');
    const ref = await resolver.allocate('patient-a', 's1', 'slot', 's1');
    await resolver.markConsumed('patient-a', 's1', ref);
    const raw = stores.get(resolver.refsKey('patient-a', 's1'));
    const store = JSON.parse(raw!) as ReferenceStore;
    expect(store.entries[ref].consumed).toBe(true);
    expect(store.entries[ref].consumedAt).toBeDefined();
  });
});
