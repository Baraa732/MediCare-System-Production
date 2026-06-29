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

const SERVICE_NAME = 'reminder-service';

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

      if (isApiErrorBody(record.message)) {
        return record.message;
      }

      const message = record.message;
      if (Array.isArray(message)) {
        return {
          code: 'VALIDATION_ERROR',
          message: 'One or more fields are invalid.',
          details: message,
          suggestion: 'Check the request body and try again.',
        };
      }

      if (typeof message === 'string') {
        return this.fromPlainMessage(message, status);
      }
    }

    if (typeof payload === 'string') {
      return this.fromPlainMessage(payload, status);
    }

    return {
      code: status === HttpStatus.UNAUTHORIZED ? 'UNAUTHORIZED' : 'REQUEST_FAILED',
      message: 'The request could not be completed.',
    };
  }

  private fromPlainMessage(message: string, status: number): ApiErrorBody {
    if (status === HttpStatus.UNAUTHORIZED) {
      return { code: 'UNAUTHORIZED', message };
    }

    if (status === HttpStatus.FORBIDDEN) {
      return { code: 'FORBIDDEN', message };
    }

    if (status === HttpStatus.NOT_FOUND) {
      return { code: 'NOT_FOUND', message };
    }

    if (status === HttpStatus.CONFLICT) {
      return { code: 'CONFLICT', message };
    }

    return {
      code: status === HttpStatus.BAD_REQUEST ? 'BAD_REQUEST' : 'REQUEST_FAILED',
      message,
    };
  }
}
