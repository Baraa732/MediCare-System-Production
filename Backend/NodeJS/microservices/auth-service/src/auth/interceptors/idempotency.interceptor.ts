import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { IdempotencyService } from '../services/idempotency.service';

/**
 * Runs after the handler returns. If the request carried an idempotency key
 * (set by IdempotencyGuard), stores the response so future duplicates get
 * the cached result without re-executing the handler.
 *
 * Must be applied AFTER IdempotencyGuard in the execution chain.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request  = context.switchToHttp().getRequest();
    const key      = request['_idempotencyKey'] as string | undefined;
    const endpoint = request['_idempotencyEndpoint'] as string | undefined;
    const payload  = request['_idempotencyPayload'];

    if (!key || !endpoint) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        const response   = context.switchToHttp().getResponse();
        const statusCode = response.statusCode ?? 200;
        // Non-blocking — if storage fails the request already succeeded
        this.idempotencyService
          .store(key, endpoint, payload, responseBody, statusCode)
          .catch(() => {/* logged inside service */});
      }),
    );
  }
}
