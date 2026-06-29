import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../services/session.service';
import { JwtBlocklistService } from '../services/jwt-blocklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private sessionService: SessionService,
    private jwtBlocklistService: JwtBlocklistService,
  ) {
    const publicKey = configService.get<string>('JWT_PUBLIC_KEY');
    const secret = configService.getOrThrow<string>('JWT_SECRET');
    const useRs256 = Boolean(configService.get<string>('JWT_PRIVATE_KEY') && publicKey);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: useRs256 ? publicKey! : secret,
      algorithms: useRs256 ? ['RS256'] : ['HS256'],
    });
  }

  /**
   * Called by Passport after signature + expiry are verified.
   *
   * We additionally validate that:
   * 1. The JWT is not in the blocklist (revoked via logout)
   * 2. The session is still ACTIVE in the database
   *
   * Without these checks, a revoked session's JWT continues to work until expiry
   * (up to 15 minutes after logout) — unacceptable in a healthcare system.
   *
   * Performance: validateSession does a single indexed lookup on sessionId.
   * Blocklist check is a Redis O(1) operation. Combined ~1-2ms per request.
   */
  async validate(payload: any) {
    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException('Malformed token');
    }

    // CRITICAL FIX: Validate token type to prevent mfa_pending tokens from being used as access tokens
    if (payload.type === 'mfa_pending') {
      throw new UnauthorizedException('MFA tokens cannot be used for regular access. Complete MFA verification first.');
    }

    if (payload.type === 'activation_pending') {
      throw new UnauthorizedException('Complete account activation before accessing protected routes.');
    }

    // Check if JWT has been revoked (added to blocklist on logout)
    if (payload.jti) {
      const isRevoked = await this.jwtBlocklistService.isRevoked(payload.jti);
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const isActive = await this.sessionService.validateSession(payload.sessionId);
    if (!isActive) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    // phoneNumber is intentionally NOT returned here — it is PHI and must not
    // be propagated through request context where it could appear in logs.
    return {
      userId: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
      clinicId: payload.tenantId ?? payload.clinicId,
      permissions: payload.permissions || [],
      sessionId: payload.sessionId,
      jti: payload.jti,
    };
  }
}
