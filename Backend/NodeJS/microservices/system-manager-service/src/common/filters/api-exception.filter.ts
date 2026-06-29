import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { logStructuredException } from '@medicare/telemetry';
import { Request, Response } from 'express';
import { ApiErrorBody, ApiErrorResponse, isApiErrorBody } from '../errors/api-error.types';

const SERVICE_NAME = 'system-manager-service';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error = this.toApiError(exception, status);

    logStructuredException(SERVICE_NAME, {
      exception,
      request,
      status,
      module: exception instanceof Error ? exception.name : 'http',
      metadata: { error_code: error.code },
    });

    const body: ApiErrorResponse = {
      success: false,
      statusCode: status,
      error,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.headers['x-request-id'] as string | undefined,
      },
    };

    response.status(status).json(body);
  }

  private toApiError(exception: unknown, status: number): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again later.',
      };
    }

    const payload = exception.getResponse();

    if (isApiErrorBody(payload)) {
      return payload;
    }

    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      const message = record.message;

      if (Array.isArray(message)) {
        return {
          code: 'VALIDATION_ERROR',
          message: 'One or more fields are invalid.',
          details: message,
        };
      }

      if (typeof message === 'string') {
        return { code: status === HttpStatus.BAD_REQUEST ? 'BAD_REQUEST' : 'REQUEST_FAILED', message };
      }
    }

    if (typeof payload === 'string') {
      return { code: 'REQUEST_FAILED', message: payload };
    }

    return { code: 'REQUEST_FAILED', message: 'The request could not be completed.' };
  }
}
