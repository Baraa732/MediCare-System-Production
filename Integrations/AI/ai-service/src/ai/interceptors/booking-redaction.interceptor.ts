import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RedactionService } from '../security/redaction.service';

/** Redacts sensitive patterns from booking-assistant request bodies and responses. */
@Injectable()
export class BookingRedactionInterceptor implements NestInterceptor {
  constructor(private readonly redaction: RedactionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ body?: { message?: string } }>();
    if (req.body?.message) {
      req.body.message = this.redaction.sanitizeUserInput(req.body.message);
    }

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'reply' in data && typeof data.reply === 'string') {
          return { ...data, reply: this.redaction.redactOutput(data.reply) };
        }
        return data;
      }),
    );
  }
}
