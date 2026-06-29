import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditResource } from '../entities/audit-log.entity';
import { SessionService } from './session.service';

export interface DeviceContext {
  ip: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  country?: string;
}

// Minimum milliseconds between two logins from different countries to be
// considered "impossible travel". 2 minutes is generous — real travel takes hours.
const IMPOSSIBLE_TRAVEL_MS = 2 * 60 * 1000;

@Injectable()
export class SessionAnomalyService {
  private readonly logger = new Logger(SessionAnomalyService.name);

  constructor(
    @InjectRepository(Session, 'authConnection')
    private sessionRepository: Repository<Session>,
    private auditLogService: AuditLogService,
    private sessionService: SessionService,
  ) {}

  // ─── Analyse a new session against the user's recent sessions ────────────────
  async analyse(
    userId: string,
    newSession: Session,
    newDevice: DeviceContext,
  ): Promise<void> {
    const recentSessions = await this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // Exclude the session we just created
    const previousSessions = recentSessions.filter(s => s.id !== newSession.id);
    if (previousSessions.length === 0) return;

    const lastSession = previousSessions[0];
    const lastDevice = lastSession.deviceInfo as DeviceContext | null;

    const anomalies: string[] = [];

    // ── Impossible travel ──────────────────────────────────────────────────────
    if (
      lastDevice?.country &&
      newDevice.country &&
      lastDevice.country !== newDevice.country
    ) {
      const timeDiff = newSession.createdAt.getTime() - lastSession.createdAt.getTime();
      if (timeDiff < IMPOSSIBLE_TRAVEL_MS) {
        anomalies.push(
          `impossible_travel:${lastDevice.country}->${newDevice.country} in ${Math.round(timeDiff / 1000)}s`,
        );
      }
    }

    // ── IP change within same token family ─────────────────────────────────────
    if (
      lastDevice?.ip &&
      newDevice.ip &&
      lastDevice.ip !== newDevice.ip &&
      newSession.tokenFamilyId === lastSession.tokenFamilyId
    ) {
      anomalies.push(`ip_change_same_family:${lastDevice.ip}->${newDevice.ip}`);
    }

    // ── Device type switch (e.g. desktop → mobile) ─────────────────────────────
    if (
      lastDevice?.deviceType &&
      newDevice.deviceType &&
      lastDevice.deviceType !== newDevice.deviceType
    ) {
      anomalies.push(`device_type_switch:${lastDevice.deviceType}->${newDevice.deviceType}`);
    }

    if (anomalies.length === 0) return;

    // Flag the session — do NOT block, log only
    newSession.isSuspicious = true;
    newSession.suspiciousReason = anomalies.join(' | ');
    await this.sessionRepository.save(newSession);

    // MEDIUM FIX: Block session for severe anomalies (impossible travel)
    const severeAnomalies = anomalies.filter(a => a.startsWith('impossible_travel'));
    const shouldBlock = severeAnomalies.length > 0;

    if (shouldBlock) {
      // Revoke the suspicious session immediately
      await this.sessionService.revokeSession(newSession.sessionId, userId);
      this.logger.warn(`Session blocked due to severe anomaly [${userId}]: ${severeAnomalies.join(' | ')}`);
    }

    await this.auditLogService.createLog({
      userId,
      sessionId: newSession.sessionId,
      action: shouldBlock ? AuditAction.SESSION_REVOKED : AuditAction.SUSPICIOUS_ACTIVITY,
      resource: AuditResource.SESSION,
      resourceId: newSession.id,
      metadata: {
        ip: newDevice.ip,
        userAgent: newDevice.userAgent,
        anomalies,
        blocked: shouldBlock,
        previousIp: lastDevice?.ip,
        previousCountry: lastDevice?.country,
        newCountry: newDevice.country,
      },
      severity: shouldBlock ? 'critical' : 'warning',
      description: shouldBlock 
        ? `Session blocked due to severe anomaly: ${anomalies.join(', ')}`
        : `Session anomaly detected: ${anomalies.join(', ')}`,
      success: true,
      risk: shouldBlock ? 'high' : 'medium',
    });

    this.logger.warn(`Session anomaly [${userId}]: ${anomalies.join(' | ')}${shouldBlock ? ' (BLOCKED)' : ''}`);
  }
}
