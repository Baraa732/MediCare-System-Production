import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Not, Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';
import { AccountLock, LockTierDb } from '../entities/account-lock.entity';
import { Session, SessionStatus } from '../entities/session.entity';

export type SecurityRange = '1h' | '6h' | '24h';

export interface SecuritySummaryResponse {
  available: true;
  timestamp: string;
  range: SecurityRange;
  failedLogins: number;
  suspicious: number;
  rateLimitExceeded: number;
  activeSessions: number;
  blockedIdentifiers: Array<{
    identifier: string;
    tier: string;
    failedAttempts: number;
    lockedUntil: string | null;
  }>;
  topIps: Array<{
    ip: string;
    count: number;
    lastSeen: string;
    actions: string[];
  }>;
  recentAudits: Array<{
    id: string;
    actor: string;
    action: string;
    target: string;
    result: string;
    ip: string | null;
    ago: string;
    createdAt: string;
  }>;
}

function rangeToMs(range: SecurityRange): number {
  if (range === '6h') return 6 * 60 * 60 * 1000;
  if (range === '24h') return 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

function formatAgo(date: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

@Injectable()
export class SecuritySummaryService {
  constructor(
    @InjectRepository(AuditLog, 'authConnection')
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AccountLock, 'authConnection')
    private readonly lockRepo: Repository<AccountLock>,
    @InjectRepository(Session, 'authConnection')
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async getSummary(range: SecurityRange = '1h'): Promise<SecuritySummaryResponse> {
    const since = new Date(Date.now() - rangeToMs(range));
    const now = new Date();

    const [failedLogins, suspicious, rateLimitExceeded, activeSessions, locks, recentLogs] =
      await Promise.all([
        this.auditRepo.count({
          where: { action: AuditAction.FAILED_LOGIN, createdAt: MoreThan(since) },
        }),
        this.auditRepo.count({
          where: { action: AuditAction.SUSPICIOUS_ACTIVITY, createdAt: MoreThan(since) },
        }),
        this.auditRepo.count({
          where: { action: AuditAction.RATE_LIMIT_EXCEEDED, createdAt: MoreThan(since) },
        }),
        this.sessionRepo
          .createQueryBuilder('s')
          .where('s.status = :status', { status: SessionStatus.ACTIVE })
          .andWhere('s.expiresAt > :now', { now })
          .getCount(),
        this.lockRepo.find({
          where: { tier: Not(LockTierDb.NONE) },
          take: 50,
          order: { updatedAt: 'DESC' },
        }),
        this.auditRepo.find({
          where: { createdAt: MoreThan(since) },
          order: { createdAt: 'DESC' },
          take: 400,
        }),
      ]);

    const ipMap = new Map<string, { count: number; lastSeen: Date; actions: Set<string> }>();
    for (const log of recentLogs) {
      if (!log.ip) continue;
      const interesting =
        log.action === AuditAction.FAILED_LOGIN ||
        log.action === AuditAction.SUSPICIOUS_ACTIVITY ||
        log.action === AuditAction.RATE_LIMIT_EXCEEDED ||
        log.success === false;
      if (!interesting) continue;
      const cur = ipMap.get(log.ip) ?? { count: 0, lastSeen: log.createdAt, actions: new Set() };
      cur.count += 1;
      if (log.createdAt > cur.lastSeen) cur.lastSeen = log.createdAt;
      cur.actions.add(log.action);
      ipMap.set(log.ip, cur);
    }

    const topIps = [...ipMap.entries()]
      .map(([ip, v]) => ({
        ip,
        count: v.count,
        lastSeen: v.lastSeen.toISOString(),
        actions: [...v.actions],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const blockedIdentifiers = locks
      .filter((l) => l.tier !== LockTierDb.NONE)
      .filter((l) => !l.lockedUntil || l.lockedUntil > now)
      .slice(0, 20)
      .map((l) => ({
        identifier: l.identifier,
        tier: l.tier,
        failedAttempts: l.failedAttempts,
        lockedUntil: l.lockedUntil?.toISOString() ?? null,
      }));

    const recentAudits = recentLogs.slice(0, 30).map((log) => ({
      id: log.id,
      actor: log.userId ?? 'anonymous',
      action: log.action,
      target: log.resourceId ?? log.resource,
      result: log.success ? 'Allowed' : 'Blocked',
      ip: log.ip ?? null,
      ago: formatAgo(log.createdAt),
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      available: true,
      timestamp: new Date().toISOString(),
      range,
      failedLogins,
      suspicious,
      rateLimitExceeded,
      activeSessions,
      blockedIdentifiers,
      topIps,
      recentAudits,
    };
  }
}
