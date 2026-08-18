import {
  Injectable, Logger, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { Session, SessionStatus } from '../entities/session.entity';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditResource } from '../entities/audit-log.entity';
import { TenantContextService } from '../../tenant-shared/tenant-context.service';
import { createTenantLogger } from '../../tenant-shared/tenant-logger';
import { asTenantUuid } from '../../tenant-shared/tenant-resolver';

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}

@Injectable()
export class SessionService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Session, 'authConnection')
    private sessionRepository: Repository<Session>,
    @InjectDataSource('authConnection')
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger = createTenantLogger(SessionService.name, tenantContext);
  }

  async createSession(
    userId: string,
    deviceInfo: DeviceInfo,
    expiresInDays = 7,
    tenantId?: string,
  ): Promise<Session> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const session = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(Session);

      // Clear any currently selected session for this user before creating a new current one.
      await sessionRepo
        .createQueryBuilder()
        .update(Session)
        .set({ isCurrent: false })
        .where('userId = :userId', { userId })
        .execute();

      const resolvedTenantId = asTenantUuid(
        tenantId ?? this.tenantContext.getTenantId() ?? undefined,
      );
      const newSession = sessionRepo.create({
        userId,
        tenantId: resolvedTenantId,
        deviceInfo,
        expiresAt,
        status: SessionStatus.ACTIVE,
        isCurrent: true,
        lastActivityAt: new Date(),
        tokenFamilyId: crypto.randomUUID(),
        reuseDetected: false,
      });

      return sessionRepo.save(newSession);
    });

    await this.auditLogService.createLog({
      userId,
      sessionId: session.id,
      action: AuditAction.SESSION_CREATED,
      resource: AuditResource.SESSION,
      resourceId: session.id,
      ip: deviceInfo.ip,
      metadata: { ip: deviceInfo.ip, userAgent: deviceInfo.userAgent, deviceInfo },
      success: true,
    });

    this.logger.log(`Session created for user ${userId}: ${session.sessionId}`);
    return session;
  }

  async getSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessionByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    return this.sessionRepository.findOne({ where: { refreshTokenHash } });
  }

  async revokeSessionByRefreshTokenHash(refreshTokenHash: string, userId: string): Promise<Session | null> {
    const session = await this.sessionRepository.findOne({ where: { refreshTokenHash } });
    if (!session || session.userId !== userId) {
      return null;
    }
    await this.revokeSession(session.sessionId, userId);
    return session;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.sessionRepository.update({ sessionId }, { lastActivityAt: new Date() });
  }

  async revokeSession(sessionId: string, userId?: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (userId && session.userId !== userId) throw new NotFoundException('Session not found for this user');

    session.revoke();
    await this.sessionRepository.save(session);

    await this.auditLogService.createLog({
      userId: session.userId,
      sessionId: session.id,
      action: AuditAction.SESSION_REVOKED,
      resource: AuditResource.SESSION,
      resourceId: session.id,
      success: true,
    });

    this.logger.log(`Session revoked: ${sessionId}`);
  }

  // Single bulk UPDATE — eliminates N+1 query pattern (was: load all → loop → save each)
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const qb = this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ status: SessionStatus.REVOKED, revokedAt: new Date() })
      .where('userId = :userId AND status = :status', { userId, status: SessionStatus.ACTIVE });

    if (exceptSessionId) {
      qb.andWhere('sessionId != :exceptSessionId', { exceptSessionId });
    }

    await qb.execute();
    this.logger.log(`All sessions revoked for user ${userId} (except: ${exceptSessionId || 'none'})`);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // Single bulk UPDATE — eliminates N+1 query pattern
  async cleanupExpiredSessions(): Promise<void> {
    const result = await this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ status: SessionStatus.EXPIRED })
      .where('expiresAt < :now AND status != :expired', {
        now: new Date(),
        expired: SessionStatus.EXPIRED,
      })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} expired sessions`);
  }

  hashRefreshToken(refreshToken: string): string {
    return crypto.createHash('sha256').update(refreshToken).digest('hex');
  }

  async generateRefreshToken(): Promise<string> {
    return crypto.randomBytes(64).toString('hex');
  }

  async assignInitialRefreshToken(sessionId: string): Promise<string> {
    const refreshToken = await this.generateRefreshToken();
    await this.sessionRepository.update(
      { sessionId },
      { refreshTokenHash: this.hashRefreshToken(refreshToken) },
    );
    return refreshToken;
  }

  /**
   * Rotate refresh token with SERIALIZABLE transaction + pessimistic write lock.
   *
   * Critical invariant: the caller must present the currently active refresh token
   * hash. We re-check that hash under lock inside this transaction.
   *
   * This closes the race where two concurrent refresh requests both passed an
   * earlier pre-check and both attempted rotation for the same session.
   */
  async rotateRefreshToken(sessionId: string, expectedRefreshTokenHash: string): Promise<string> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager: EntityManager) => {
      const session = await manager.findOne(Session, {
        where: { sessionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session) throw new NotFoundException('Session not found');

      if (session.reuseDetected) {
        this.logger.error(`Refresh token reuse detected for session ${sessionId} — revoking entire family`);
        await manager
          .createQueryBuilder()
          .update(Session)
          .set({ status: SessionStatus.REVOKED, revokedAt: new Date(), reuseDetected: true })
          .where('tokenFamilyId = :fid AND status = :status', {
            fid: session.tokenFamilyId,
            status: SessionStatus.ACTIVE,
          })
          .execute();
        throw new UnauthorizedException('Refresh token reuse detected. All sessions revoked for security.');
      }

      if (!session.isActive()) {
        throw new UnauthorizedException('Session expired or revoked');
      }

      // Refresh token was already rotated by another request.
      if (!session.refreshTokenHash || session.refreshTokenHash !== expectedRefreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newRefreshToken = await this.generateRefreshToken();
      session.refreshTokenHash = this.hashRefreshToken(newRefreshToken);
      session.incrementTokenRotation();
      session.lastActivityAt = new Date();

      await manager.save(Session, session);

      // Audit log outside the transaction so a log failure doesn't roll back the rotation
      setImmediate(() => {
        this.auditLogService.createLog({
          userId: session.userId,
          sessionId: session.id,
          action: AuditAction.TOKEN_REFRESH,
          resource: AuditResource.TOKEN,
          resourceId: session.id,
          metadata: { rotationCount: session.tokenRotationCount },
          success: true,
        }).catch((err) => this.logger.error('Audit log failed after token rotation:', err.message));
      });

      this.logger.log(`Refresh token rotated for session ${sessionId}`);
      return newRefreshToken;
    });
  }

  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      return session.isActive();
    } catch {
      return false;
    }
  }
}
