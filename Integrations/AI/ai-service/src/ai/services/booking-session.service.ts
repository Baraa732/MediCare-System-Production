import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { BookingSession, BookingStep } from '../security/references/reference.types';
import { ReferenceResolverService } from '../security/references/reference-resolver.service';
import { getCorrelationId, hashRef } from '../security/secure-logging';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';

@Injectable()
export class BookingSessionService {
  private readonly redis: Redis;
  private readonly logger = new Logger(BookingSessionService.name);
  private readonly ttl = 3600;

  constructor(
    private configService: ConfigService,
    private referenceResolver: ReferenceResolverService,
    private readonly tenantContext: TenantContextService,
  ) {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(redisUrl);
  }

  private tenantScope(): string {
    return this.tenantContext.getTenantId() ?? 'platform';
  }

  private sessionKey(patientId: string, sessionId: string): string {
    return `booking:session:${this.tenantScope()}:${patientId}:${sessionId}`;
  }

  private legacyKey(sessionId: string): string {
    return `booking:session:${sessionId}`;
  }

  private activeKey(patientId: string): string {
    return `booking:active-session:${this.tenantScope()}:${patientId}`;
  }

  async getActiveSessionId(patientId: string): Promise<string | null> {
    try {
      return await this.redis.get(this.activeKey(patientId));
    } catch {
      return null;
    }
  }

  async assertActiveSession(patientId: string, sessionId: string): Promise<BookingSession> {
    await this.assertActiveSessionId(patientId, sessionId);
    return this.get(patientId, sessionId);
  }

  private async assertActiveSessionId(patientId: string, sessionId: string): Promise<void> {
    const active = await this.getActiveSessionId(patientId);
    if (!active || active !== sessionId) {
      throw new BadRequestException(
        'Invalid or expired booking session. Call POST /v1/ai/patient-booking-session first.',
      );
    }
  }

  async initSession(
    patientId: string,
    resumeToken?: string,
  ): Promise<{ sessionId: string; expiresInSeconds: number }> {
    const sessionId = randomUUID();
    const oldActive = await this.getActiveSessionId(patientId);

    if (resumeToken) {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: resumeToken.length > 20 ? 'legacy_resume_token_used' : 'session_resume_used',
        resumeTokenRef: hashRef(resumeToken),
      });
      await this.redis.del(this.legacyKey(resumeToken));
      if (oldActive && oldActive !== resumeToken) {
        await this.redis.del(this.sessionKey(patientId, oldActive));
        await this.referenceResolver.deleteStore(patientId, oldActive);
      }
    } else if (oldActive) {
      await this.redis.del(this.sessionKey(patientId, oldActive));
      await this.redis.del(this.legacyKey(oldActive));
      await this.referenceResolver.deleteStore(patientId, oldActive);
    }

    await this.redis.setex(this.activeKey(patientId), this.ttl, sessionId);
    await this.referenceResolver.initStore(patientId, sessionId);
    await this.save(patientId, sessionId, { step: 'start' });

    return { sessionId, expiresInSeconds: this.ttl };
  }

  async get(patientId: string, sessionId: string): Promise<BookingSession> {
    try {
      const scoped = await this.redis.get(this.sessionKey(patientId, sessionId));
      if (scoped) {
        return this.sanitizeSession(JSON.parse(scoped));
      }

      const legacyRaw = await this.redis.get(this.legacyKey(sessionId));
      if (!legacyRaw) return {};

      const legacy = this.sanitizeSession(JSON.parse(legacyRaw));
      await this.save(patientId, sessionId, legacy);
      await this.redis.del(this.legacyKey(sessionId));
      return legacy;
    } catch {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'session_get_failed',
        sessionRef: hashRef(sessionId),
      });
      return {};
    }
  }

  async save(patientId: string, sessionId: string, session: BookingSession): Promise<void> {
    try {
      const payload = this.sanitizeSession(session);
      await this.redis.setex(
        this.sessionKey(patientId, sessionId),
        this.ttl,
        JSON.stringify(payload),
      );
      await this.redis.expire(this.activeKey(patientId), this.ttl);
    } catch {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'session_save_failed',
        sessionRef: hashRef(sessionId),
      });
    }
  }

  async delete(patientId: string, sessionId: string): Promise<void> {
    try {
      await this.redis.del(this.sessionKey(patientId, sessionId));
      await this.redis.del(this.legacyKey(sessionId));
      await this.referenceResolver.deleteStore(patientId, sessionId);
      const active = await this.getActiveSessionId(patientId);
      if (active === sessionId) {
        await this.redis.del(this.activeKey(patientId));
      }
    } catch {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: 'session_delete_failed',
        sessionRef: hashRef(sessionId),
      });
    }
  }

  /** Strip legacy UUID fields; patient identity lives in Redis key namespace only. */
  private sanitizeSession(raw: BookingSession | Record<string, unknown>): BookingSession {
    const step = this.normalizeStep(raw.step);
    return {
      step,
      selectedClinicRef: typeof raw.selectedClinicRef === 'string' ? raw.selectedClinicRef : undefined,
      selectedDoctorRef: typeof raw.selectedDoctorRef === 'string' ? raw.selectedDoctorRef : undefined,
      pendingSlotRef: typeof raw.pendingSlotRef === 'string' ? raw.pendingSlotRef : undefined,
      pendingAppointmentRef:
        typeof raw.pendingAppointmentRef === 'string' ? raw.pendingAppointmentRef : undefined,
      clinicName: typeof raw.clinicName === 'string' ? raw.clinicName : undefined,
      doctorName: typeof raw.doctorName === 'string' ? raw.doctorName : undefined,
      date: typeof raw.date === 'string' ? raw.date : undefined,
      slotTime: typeof raw.slotTime === 'string' ? raw.slotTime : undefined,
    };
  }

  private normalizeStep(step: unknown): BookingStep | undefined {
    if (step === 'confirm') return 'confirm_book';
    const allowed: BookingStep[] = [
      'start',
      'pick_doctor',
      'pick_slot',
      'confirm_book',
      'confirm_modify',
      'confirm_cancel',
      'completed',
    ];
    return allowed.includes(step as BookingStep) ? (step as BookingStep) : undefined;
  }
}
