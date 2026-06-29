import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import {
  ReferenceEntry,
  ReferenceError,
  ReferencePrefix,
  ReferenceStore,
  ReferenceType,
  REF_PREFIX_BY_TYPE,
  REF_TOKEN_PATTERN,
  UUID_PATTERN,
} from './reference.types';
import { getCorrelationId } from '../secure-logging';

const REF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

@Injectable()
export class ReferenceResolverService {
  private readonly redis: Redis;
  private readonly logger = new Logger(ReferenceResolverService.name);
  private readonly ttl = 3600;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(redisUrl);
  }

  refsKey(patientId: string, sessionId: string): string {
    return `booking:refs:${patientId}:${sessionId}`;
  }

  async initStore(patientId: string, sessionId: string): Promise<void> {
    const store: ReferenceStore = { entries: {} };
    await this.saveStore(patientId, sessionId, store);
  }

  async deleteStore(patientId: string, sessionId: string): Promise<void> {
    await this.redis.del(this.refsKey(patientId, sessionId));
  }

  async loadStore(patientId: string, sessionId: string): Promise<ReferenceStore | null> {
    const raw = await this.redis.get(this.refsKey(patientId, sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as ReferenceStore;
  }

  async saveStore(patientId: string, sessionId: string, store: ReferenceStore): Promise<void> {
    await this.redis.setex(this.refsKey(patientId, sessionId), this.ttl, JSON.stringify(store));
  }

  assertRefFormat(ref: string, expectedPrefix?: ReferencePrefix): void {
    if (UUID_PATTERN.test(ref)) {
      throw new ReferenceError('uuid_not_allowed');
    }
    if (!REF_TOKEN_PATTERN.test(ref)) {
      throw new ReferenceError('malformed_reference');
    }
    if (expectedPrefix && !ref.startsWith(`${expectedPrefix}-`)) {
      throw new ReferenceError('malformed_reference');
    }
  }

  async allocate(
    patientId: string,
    sessionId: string,
    type: ReferenceType,
    id: string,
    meta?: ReferenceEntry['meta'],
    parentRef?: string,
  ): Promise<string> {
    const store = (await this.loadStore(patientId, sessionId)) || { entries: {} };
    const prefix = REF_PREFIX_BY_TYPE[type];
    const ref = this.generateUniqueRef(prefix, store);
    store.entries[ref] = {
      type,
      id,
      createdAt: new Date().toISOString(),
      parentRef,
      consumed: false,
      meta,
    };
    await this.saveStore(patientId, sessionId, store);
    return ref;
  }

  async resolve(
    patientId: string,
    sessionId: string,
    ref: string,
    expectedType: ReferenceType,
    options?: { allowConsumed?: boolean },
  ): Promise<ReferenceEntry> {
    this.assertRefFormat(ref, REF_PREFIX_BY_TYPE[expectedType]);
    const store = await this.loadStore(patientId, sessionId);
    if (!store) {
      throw new ReferenceError('expired_reference');
    }
    const entry = store.entries[ref];
    if (!entry) {
      throw new ReferenceError('unknown_reference');
    }
    if (entry.type !== expectedType) {
      throw new ReferenceError('malformed_reference');
    }
    if (entry.consumed && !options?.allowConsumed) {
      throw new ReferenceError('reference_consumed');
    }
    return entry;
  }

  async resolveId(
    patientId: string,
    sessionId: string,
    ref: string,
    expectedType: ReferenceType,
    options?: { allowConsumed?: boolean },
  ): Promise<string> {
    const entry = await this.resolve(patientId, sessionId, ref, expectedType, options);
    return entry.id;
  }

  async markConsumed(patientId: string, sessionId: string, ref: string): Promise<void> {
    const store = await this.loadStore(patientId, sessionId);
    if (!store?.entries[ref]) {
      throw new ReferenceError('unknown_reference');
    }
    store.entries[ref].consumed = true;
    store.entries[ref].consumedAt = new Date().toISOString();
    await this.saveStore(patientId, sessionId, store);
  }

  private generateUniqueRef(prefix: ReferencePrefix, store: ReferenceStore): string {
    for (let attempt = 0; attempt < 32; attempt++) {
      const suffix = Array.from(randomBytes(4))
        .map((b) => REF_CHARS[b % REF_CHARS.length])
        .join('');
      const ref = `${prefix}-${suffix}`;
      if (!store.entries[ref]) {
        return ref;
      }
    }
    this.logger.error({
      correlationId: getCorrelationId(),
      reason: 'ref_allocation_failed',
    });
    throw new ReferenceError('unknown_reference', 'ref_allocation_failed');
  }
}
