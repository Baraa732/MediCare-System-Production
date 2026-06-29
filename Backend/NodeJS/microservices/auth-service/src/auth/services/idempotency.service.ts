import {
  Injectable, Logger, ConflictException, HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { createHash } from 'crypto';
import { IdempotencyKey } from '../entities/idempotency-key.entity';

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  cachedResponse?: Record<string, unknown>;
  cachedStatusCode?: number;
}

const KEY_TTL_HOURS = 24;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey, 'authConnection')
    private idempotencyRepository: Repository<IdempotencyKey>,
  ) {}

  // ─── Hash the request body for conflict detection ─────────────────────────
  hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  // ─── Check if a key has been seen before ──────────────────────────────────
  // Returns:
  //   isDuplicate=false  → first time seeing this key, proceed normally
  //   isDuplicate=true   → same key + same payload, return cached response
  //   throws 409         → same key + different payload (client bug)
  async check(
    key: string,
    endpoint: string,
    payload: unknown,
  ): Promise<IdempotencyCheckResult> {
    const existing = await this.idempotencyRepository.findOne({
      where: { key },
    });

    if (!existing) {
      return { isDuplicate: false };
    }

    // Key exists but has expired — treat as new
    if (existing.expiresAt < new Date()) {
      await this.idempotencyRepository.delete(existing.id);
      return { isDuplicate: false };
    }

    const incomingHash = this.hashPayload(payload);

    // Same key, different payload — this is a client error
    if (existing.requestHash !== incomingHash) {
      this.logger.warn(
        `Idempotency conflict: key=${key} endpoint=${endpoint} ` +
        `existing_hash=${existing.requestHash} incoming_hash=${incomingHash}`,
      );
      throw new ConflictException(
        'An idempotency key cannot be reused with a different request body. ' +
        'Use a new key for a different request.',
      );
    }

    // Same key, same payload — return cached response
    this.logger.debug(`Idempotency cache hit: key=${key} endpoint=${endpoint}`);
    return {
      isDuplicate: true,
      cachedResponse: existing.response,
      cachedStatusCode: existing.statusCode,
    };
  }

  // ─── Store the response after a successful operation ──────────────────────
  async store(
    key: string,
    endpoint: string,
    payload: unknown,
    response: Record<string, unknown>,
    statusCode = 200,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + KEY_TTL_HOURS);

    try {
      await this.idempotencyRepository.upsert(
        {
          key,
          endpoint,
          requestHash: this.hashPayload(payload),
          response,
          statusCode,
          expiresAt,
        },
        ['key'],
      );
    } catch (err: any) {
      // Non-fatal — log and continue. The operation already succeeded.
      // The worst case is the client retries and the operation runs again,
      // which is why the underlying operations must also be idempotent.
      this.logger.error(`Failed to store idempotency key ${key}: ${err.message}`);
    }
  }

  // ─── Cleanup expired keys — call from a scheduled job ────────────────────
  async cleanupExpired(): Promise<number> {
    const result = await this.idempotencyRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}
