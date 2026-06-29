import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

export interface RegistrationErrorBody {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

export function phoneAlreadyRegistered(): BadRequestException {
  return new BadRequestException({
    code: 'PHONE_ALREADY_REGISTERED',
    message: 'This phone number is already registered.',
    field: 'phoneNumber',
    suggestion: 'Sign in to your account or request a new OTP via send-otp.',
  } satisfies RegistrationErrorBody);
}

export function emailAlreadyRegistered(): BadRequestException {
  return new BadRequestException({
    code: 'EMAIL_ALREADY_REGISTERED',
    message: 'This email address is already linked to another account.',
    field: 'email',
    suggestion: 'Use a different email or sign in with the account that owns this email.',
  } satisfies RegistrationErrorBody);
}

export function usernameAlreadyTaken(): BadRequestException {
  return new BadRequestException({
    code: 'USERNAME_ALREADY_TAKEN',
    message: 'This username is already taken.',
    field: 'username',
    suggestion: 'Choose a different username.',
  } satisfies RegistrationErrorBody);
}

export function rethrowIfRegistrationError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof QueryFailedError) {
    const pgError = error.driverError as { constraint?: string; detail?: string };
    const haystack = `${pgError.constraint ?? ''} ${pgError.detail ?? ''} ${error.message}`.toLowerCase();

    if (haystack.includes('email')) {
      throw emailAlreadyRegistered();
    }
    if (haystack.includes('phone')) {
      throw phoneAlreadyRegistered();
    }
    if (haystack.includes('username')) {
      throw usernameAlreadyTaken();
    }

    throw new BadRequestException({
      code: 'DUPLICATE_ENTRY',
      message: 'An account with these details already exists.',
      suggestion: 'Change the conflicting information and try again.',
    } satisfies RegistrationErrorBody);
  }

  throw error;
}
