import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import {
  INTERNAL_AUTH_HEADERS,
  loadRuntimeInternalAuthConfig,
  verifyInternalRequest,
} from '../../internal-auth-shared';

/**
 * Verifies Bearer JWT locally. If verification fails (e.g. SYSTEM_MANAGER token
 * signed by system-manager-service with a different secret), fall back to the
 * identity the API Gateway already validated and forwarded via x-user-* headers,
 * but only when the request carries a valid api-gateway internal HMAC.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = this.jwtService.verify(token, {
        algorithms: ['HS256'],
      });
      request.user = {
        userId: payload.sub,
        phoneNumber: payload.phoneNumber,
        role: payload.role,
        tenantId: payload.tenantId ?? payload.clinicId,
        clinicId: payload.tenantId ?? payload.clinicId,
        permissions: payload.permissions || [],
        sessionId: payload.sessionId,
      };
      return true;
    } catch {
      const gatewayUser = this.tryGatewayIdentity(request);
      if (gatewayUser) {
        request.user = gatewayUser;
        return true;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private tryGatewayIdentity(request: any) {
    const headers = request.headers as Record<string, string | string[] | undefined>;
    const callerRaw = headers[INTERNAL_AUTH_HEADERS.SERVICE_NAME];
    const signatureRaw = headers[INTERNAL_AUTH_HEADERS.SIGNATURE];
    const timestampRaw = headers[INTERNAL_AUTH_HEADERS.TIMESTAMP];
    const userIdRaw = headers['x-user-id'];
    const roleRaw = headers['x-user-role'];

    const callerName = Array.isArray(callerRaw) ? callerRaw[0] : callerRaw;
    const signature = Array.isArray(signatureRaw) ? signatureRaw[0] : signatureRaw;
    const timestamp = Array.isArray(timestampRaw) ? timestampRaw[0] : timestampRaw;
    const userId = Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw;
    const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;

    if (callerName !== 'api-gateway' || !signature || !timestamp || !userId || !role) {
      return null;
    }

    let gatewaySecret: string | undefined;
    try {
      gatewaySecret = loadRuntimeInternalAuthConfig().trustedSecrets['api-gateway'];
    } catch {
      return null;
    }
    if (!gatewaySecret) return null;

    const method = (request.method || 'GET').toUpperCase();
    // Gateway signs GET/DELETE with an empty body string — ignore parsed {}.
    const body = method === 'GET' || method === 'HEAD' || method === 'DELETE' ? '' : request.body;
    const pathCandidates = [
      (request.originalUrl || '').split('?')[0],
      (request.url || '').split('?')[0],
      (request.path || '').split('?')[0],
    ].filter(Boolean);
    const signatureOk = pathCandidates.some((path) =>
      verifyInternalRequest(gatewaySecret!, method, path, body, timestamp, signature),
    );
    if (!signatureOk) {
      return null;
    }

    const tenantRaw = headers['x-tenant-id'] ?? headers['x-clinic-id'];
    const tenantId = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
    const sessionRaw = headers['x-session-id'];
    const sessionId = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw;

    return {
      userId,
      role,
      tenantId: tenantId || undefined,
      clinicId: tenantId || undefined,
      permissions: [] as string[],
      sessionId: sessionId || undefined,
    };
  }

  private extractTokenFromHeader(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
