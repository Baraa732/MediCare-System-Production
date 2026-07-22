import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsEmail,
  IsArray,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';
import { ClinicType } from '../enums/clinic-activation.enums';

/** Create activation code with clinic profile, admin data, map coordinates, and documents. */
export class CreateActivationCodeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  idNumber: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  whatsappNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  clinicName: string;

  @IsEnum(ClinicType)
  clinicType: ClinicType;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  registrationLicenseNumber: string;

  @IsDateString()
  @IsOptional()
  establishmentDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  specialties: string[];

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  serviceRadiusKm?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsBoolean()
  isCashPaymentDone: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export type GenerateActivationCodeDto = CreateActivationCodeDto;

export class ValidateActivationCodeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class RevokeActivationCodeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
