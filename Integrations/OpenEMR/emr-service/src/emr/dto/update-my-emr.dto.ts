import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** OpenEMR Standard API patient fields the patient portal may edit. No insurance/billing. */
export class UpdateMyEmrPatientDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  middleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  language?: string;
}

export class UpdateMyEmrContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;
}

export class UpdateMyEmrEmergencyContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string;
}

export class UpdateMyEmrDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMyEmrPatientDto)
  patient?: UpdateMyEmrPatientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMyEmrContactDto)
  contactInformation?: UpdateMyEmrContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMyEmrEmergencyContactDto)
  emergencyContact?: UpdateMyEmrEmergencyContactDto;
}
