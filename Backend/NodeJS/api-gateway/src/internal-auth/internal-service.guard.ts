import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { INTERNAL_AUTH_HEADERS, InternalServiceName } from './types';
import { verifyInternalRequest } from './internal-auth.crypto';
import { loadRuntimeInternalAuthConfig } from './internal-auth.config';
import { isCallerAllowedForRoute } from './route-allowlists';
import {
  INTERNAL_ROUTE_ALLOW_KEY,
} from './internal-route-allow.decorator';
import { isKnownInternalServiceName } from './internal-http.signer';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers as Record<string, string | string[] | undefined>;

    if (headers[INTERNAL_AUTH_HEADERS.LEGACY_TOKEN]) {
      throw new UnauthorizedException('Legacy internal service token is not accepted');
    }

    const callerRaw = headers[INTERNAL_AUTH_HEADERS.SERVICE_NAME];
    const signatureRaw = headers[INTERNAL_AUTH_HEADERS.SIGNATURE];
    const timestampRaw = headers[INTERNAL_AUTH_HEADERS.TIMESTAMP];

    const callerName = Array.isArray(callerRaw) ? callerRaw[0] : callerRaw;
    const signature = Array.isArray(signatureRaw) ? signatureRaw[0] : signatureRaw;
    const timestamp = Array.isArray(timestampRaw) ? timestampRaw[0] : timestampRaw;

    if (!callerName || !signature || !timestamp) {
      throw new UnauthorizedException('Missing internal service authentication headers');
    }

    if (!isKnownInternalServiceName(callerName)) {
      throw new UnauthorizedException('Unknown internal service identity');
    }

    const { serviceName: owningService, trustedSecrets } = loadRuntimeInternalAuthConfig();
    const callerSecret = trustedSecrets[callerName];
    if (!callerSecret) {
      throw new UnauthorizedException('Untrusted internal service caller');
    }

    const method = (request.method || 'GET').toUpperCase();
    const path = (request.originalUrl || request.url || request.path || '').split('?')[0];
    const body = request.body;

    if (!verifyInternalRequest(callerSecret, method, path, body, timestamp, signature)) {
      throw new UnauthorizedException('Invalid internal service request signature');
    }

    const decoratorAllow = this.reflector.getAllAndOverride<InternalServiceName[] | undefined>(
      INTERNAL_ROUTE_ALLOW_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      !isCallerAllowedForRoute(
        owningService,
        method,
        path,
        callerName,
        decoratorAllow,
      )
    ) {
      throw new ForbiddenException('Internal caller is not allowed for this route');
    }

    request.internalCaller = callerName;
    return true;
  }
}

declare global {
  namespace Express {
    interface Request {
      internalCaller?: string;
    }
  }
}

export {};
