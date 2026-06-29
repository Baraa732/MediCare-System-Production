import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Session, SessionStatus } from '../src/auth/entities/session.entity';
import { SessionService } from '../src/auth/services/session.service';

describe('SessionService refresh token rotation race safety', () => {
  function createServiceWithSerializedTransaction(initialSession: Session): SessionService {
    let txQueue = Promise.resolve();

    const manager = {
      findOne: jest.fn(async (_entity: unknown, opts?: { where?: { sessionId?: string } }) => {
        if (opts?.where?.sessionId === initialSession.sessionId) {
          return initialSession;
        }
        return null;
      }),
      save: jest.fn(async (_entity: unknown, session: Session) => session),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    const dataSource = {
      transaction: jest.fn(async (_level: string, work: (mgr: typeof manager) => Promise<unknown>) => {
        const run = txQueue.then(() => work(manager));
        txQueue = run.then(() => undefined, () => undefined);
        return run;
      }),
    };

    const auditLogService = {
      createLog: jest.fn().mockResolvedValue(undefined),
    };

    return new SessionService(
      {} as any,
      dataSource as any,
      auditLogService as any,
      { getTenantId: () => null, getStore: () => undefined } as any,
    );
  }

  it('rejects a second refresh using the same old token hash', async () => {
    const oldRefreshToken = 'old-refresh-token';
    const session = new Session();
    const oldHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');

    session.sessionId = 'session-1';
    session.userId = 'user-1';
    session.status = SessionStatus.ACTIVE;
    session.expiresAt = new Date(Date.now() + 60_000);
    session.refreshTokenHash = oldHash;
    session.tokenRotationCount = 0;

    const raceSafeService = createServiceWithSerializedTransaction(session);

    const [first, second] = await Promise.allSettled([
      raceSafeService.rotateRefreshToken(session.sessionId, oldHash),
      raceSafeService.rotateRefreshToken(session.sessionId, oldHash),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(UnauthorizedException);
      expect(second.reason.message).toBe('Invalid refresh token');
    }
  });
});
