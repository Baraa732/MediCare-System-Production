import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { IntegrityMacFailedError, IntegrityMacFailedEvent } from './memory.errors';

export type IntegrityMacFailedHandler = (event: IntegrityMacFailedEvent) => void;

@Injectable()
export class IntegrityService {
  private onMacFailed?: IntegrityMacFailedHandler;

  constructor(private readonly config: ConfigService) {}

  /** Hook for Phase 3b audit logging (`integrity.mac_failed`). */
  registerMacFailedHandler(handler: IntegrityMacFailedHandler): void {
    this.onMacFailed = handler;
  }

  computeMac(plaintext: string | Buffer, integrityKeyVersion?: number): string {
    const key = this.getIntegrityKey(integrityKeyVersion ?? this.getActiveIntegrityKeyVersion());
    return createHmac('sha256', key).update(plaintext).digest('hex');
  }

  verifyMac(
    plaintext: string | Buffer,
    expectedMac: string,
    ctx?: { threadId?: string; seq?: number; integrityKeyVersion?: number },
  ): void {
    const versions = this.resolveVerificationVersions(ctx?.integrityKeyVersion);

    for (const version of versions) {
      const computed = this.computeMac(plaintext, version);
      if (this.safeEqualHex(computed, expectedMac)) {
        return;
      }
    }

    this.emitMacFailed(ctx);
    throw new IntegrityMacFailedError();
  }

  getActiveIntegrityKeyVersion(): number {
    const version = Number(this.config.get<string>('MEMORY_INTEGRITY_KEY_VERSION') || '1');
    return Number.isFinite(version) && version > 0 ? version : 1;
  }

  private resolveVerificationVersions(explicit?: number): number[] {
    if (explicit !== undefined) {
      return [explicit];
    }

    const current = this.getActiveIntegrityKeyVersion();
    const previous = current - 1;
    const versions = [current];

    if (previous >= 1 && this.config.get<string>('MEMORY_INTEGRITY_KEY_PREVIOUS')) {
      versions.push(previous);
    }

    return versions;
  }

  private getIntegrityKey(version: number): Buffer {
    const active = this.getActiveIntegrityKeyVersion();
    const primary = this.config.get<string>('MEMORY_INTEGRITY_KEY');
    const previous = this.config.get<string>('MEMORY_INTEGRITY_KEY_PREVIOUS');

    const material =
      version === active ? primary : version === active - 1 ? previous || primary : primary;

    if (!material) {
      throw new IntegrityMacFailedError('MEMORY_INTEGRITY_KEY is not configured');
    }

    const key = Buffer.from(material, 'base64');
    if (key.length < 32) {
      throw new IntegrityMacFailedError('MEMORY_INTEGRITY_KEY must be at least 32 bytes (base64)');
    }
    return key;
  }

  private safeEqualHex(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  private emitMacFailed(ctx?: { threadId?: string; seq?: number }): void {
    this.onMacFailed?.({
      reason: 'integrity.mac_failed',
      threadId: ctx?.threadId,
      seq: ctx?.seq,
    });
  }
}
