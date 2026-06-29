import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OutboundSanitizerService } from '../security/outbound-sanitizer.service';

/**
 * Boundary defense: strips internal identifiers (UUID of any version, JWT,
 * internal endpoints, credentials) from any `answer`/`reply` string in an AI
 * response. Catches leaks regardless of which service produced the text — and
 * also sanitizes cache-hit responses on the way out.
 */
@Injectable()
export class OutboundResponseInterceptor implements NestInterceptor {
  constructor(private readonly sanitizer: OutboundSanitizerService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (!data || typeof data !== 'object') return data;
        const record = data as Record<string, unknown>;
        const out: Record<string, unknown> = { ...record };
        for (const key of ['answer', 'reply']) {
          if (typeof record[key] === 'string') {
            out[key] = this.sanitizer.sanitizeUserResponse(record[key] as string);
          }
        }
        return out;
      }),
    );
  }
}
