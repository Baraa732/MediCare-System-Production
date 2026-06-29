import { BadRequestException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { isApiErrorBody } from '../errors/api-error.types';

export function mapUserServiceHttpError(error: unknown): never {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as Record<string, unknown>;

    if (isApiErrorBody(data.error)) {
      throw new BadRequestException(data.error);
    }

    const message = data.message;
    if (isApiErrorBody(message)) {
      throw new BadRequestException(message);
    }

    if (typeof message === 'string') {
      throw new BadRequestException(message);
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
      throw new BadRequestException(message[0]);
    }
  }

  throw error;
}
