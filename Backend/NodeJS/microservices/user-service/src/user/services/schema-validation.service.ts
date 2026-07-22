import { Injectable, Logger } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * Fix 25: Kafka message schema validation service.
 * Validates incoming Kafka messages against expected schemas.
 */
@Injectable()
export class SchemaValidationService {
  private readonly logger = new Logger(SchemaValidationService.name);

  /**
   * Validate a message payload against a schema class.
   * Returns true if valid, false otherwise.
   */
  async validate<T>(payload: any, schemaClass: new () => T): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      const schemaInstance = plainToClass(schemaClass, payload);
      const errors = await validate(schemaInstance as object);

      if (errors.length > 0) {
        const errorMessages = errors.map(err => 
          Object.values(err.constraints || {}).join(', ')
        );
        this.logger.warn(`Schema validation failed: ${errorMessages.join('; ')}`);
        return { isValid: false, errors: errorMessages };
      }

      return { isValid: true };
    } catch (error: any) {
      this.logger.error(`Schema validation error: ${error.message}`);
      return { isValid: false, errors: [error.message] };
    }
  }
}

/**
 * Schema definitions for Kafka messages.
 * These classes define the expected structure of messages.
 */
export class UserCreateSchema {
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  clinicId?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class UserLoginRequestSchema {
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UserVerifyOtpSchema {
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}

export class UserLinkPatientAccountSchema {
  @IsString()
  @IsNotEmpty()
  systemManagerId!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

export class UserUnlinkAccountSchema {
  @IsString()
  @IsNotEmpty()
  systemManagerId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class UserGetLinkedAccountsSchema {
  @IsString()
  @IsNotEmpty()
  systemManagerId!: string;
}
