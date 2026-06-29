import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RedactionService } from '../../ai/security/redaction.service';
import { getCorrelationId } from '../../ai/security/secure-logging';

@Injectable()
@Catch()
export class AiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AiExceptionFilter.name);

  constructor(private readonly redaction: RedactionService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isBookingRoute = this.isBookingRoute(request.url);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string' ? { statusCode: status, message: body } : body;
      response.status(status).json(isBookingRoute ? this.redaction.redactValue(payload) : payload);
      return;
    }

    this.logger.error({
      correlationId: getCorrelationId(),
      reason: 'unhandled_exception',
      errorName:
        exception && typeof exception === 'object' && 'name' in exception
          ? String((exception as { name?: unknown }).name)
          : 'unknown',
      errorMessage:
        exception && typeof exception === 'object' && 'message' in exception
          ? this.redaction.redactOutput(String((exception as { message?: unknown }).message))
          : undefined,
    });

    const payload = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'AI processing failed. Please retry in a moment.',
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      isBookingRoute ? this.redaction.redactValue(payload) : payload,
    );
  }

  private isBookingRoute(url: string): boolean {
    return url.includes('patient-booking-assistant') || url.includes('patient-booking-session');
  }
}
