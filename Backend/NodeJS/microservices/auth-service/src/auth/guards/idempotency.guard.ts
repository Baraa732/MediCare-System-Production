import {
  Injectable, CanActivate, ExecutionContext,
  BadRequestException, ConflictException, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyService } from '../services/idempotency.service';
import { UserHttpClient } from '../services/user-http.client';
import { PhoneUtils } from '../../common/utils/phone.utils';

export const IDEMPOTENCY_KEY = 'idempotency';

/**
 * @Idempotent() — apply to any write endpoint (POST/PUT/PATCH).
 *
 * Behaviour:
 *   Client sends:  Idempotency-Key: <uuid>
 *   First call:    executes normally, stores response
 *   Retry (same key + same body): returns stored response immediately
 *   Retry (same key + different body): 409 Conflict
 *   No header:     executes normally (idempotency is opt-in per client)
 *
 * Why opt-in and not mandatory?
 *   Some clients (Postman, curl) don't send the header. Making it mandatory
 *   would break all existing integrations. The guard is a no-op when the
 *   header is absent — the underlying operation must still be idempotent
 *   at the DB level (unique constraints, upserts).
 */
export const Idempotent = () => SetMetadata(IDEMPOTENCY_KEY, true);

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private idempotencyService: IdempotencyService,
    private userHttp: UserHttpClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENCY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isIdempotent) return true;

    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    // CRITICAL FIX: Make idempotency mandatory for write endpoints
    // Previously opt-in (returned true if no key), now mandatory (throws if no key)
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required for this endpoint');
    }

    // Validate that the key is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }

    const endpoint = `${request.method}:${request.path}`;
    const payload = request.body;

    const result = await this.idempotencyService.check(idempotencyKey, endpoint, payload);

    if (result.isDuplicate) {
      const response = context.switchToHttp().getResponse();
      const cachedResponse = await this.sanitizeCachedResponse(endpoint, payload, result.cachedResponse);
      response.status(result.cachedStatusCode ?? 200).json(cachedResponse);
      return false;
    }

    // Store key + endpoint on request so the interceptor can save the response
    request['_idempotencyKey'] = idempotencyKey;
    request['_idempotencyEndpoint'] = endpoint;
    request['_idempotencyPayload'] = payload;

    return true;
  }

  private async sanitizeCachedResponse(
    endpoint: string,
    payload: unknown,
    cachedResponse?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!cachedResponse) return {};

    if (!endpoint.endsWith('register')) {
      return cachedResponse;
    }

    const phoneNumber = (payload as { phoneNumber?: string })?.phoneNumber;
    if (!phoneNumber) {
      return this.stripStaleDevOtp(cachedResponse);
    }

    try {
      const formattedPhone = PhoneUtils.validateAndFormat(phoneNumber);
      const alreadyRegistered = await this.userHttp.checkExists(formattedPhone);
      if (alreadyRegistered) {
        return {
          message:
            'Registration already completed for this phone number. Login with your password, or call POST /api/auth/send-otp for a fresh OTP.',
          alreadyRegistered: true,
          whatsappSent: false,
        };
      }
    } catch {
      // Fall through to stripped cached response
    }

    return this.stripStaleDevOtp(cachedResponse);
  }

  private stripStaleDevOtp(cachedResponse: Record<string, unknown>): Record<string, unknown> {
    const { devOtp: _removed, ...rest } = cachedResponse;
    return {
      ...rest,
      note:
        'Idempotent replay — the original OTP may already be used or expired. Call POST /api/auth/send-otp to get a new code.',
    };
  }
}
