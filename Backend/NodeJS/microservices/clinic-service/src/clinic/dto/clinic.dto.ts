import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClinicStatus } from '../entities/clinic.entity';
import { StaffRole } from '../entities/clinic-staff-assignment.entity';

export class CreateClinicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  governorate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  governorate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsEnum(ClinicStatus)
  status?: ClinicStatus;
}

export class AssignStaffDto {
  @IsUUID()
  userId: string;

  @IsEnum(StaffRole)
  staffRole: StaffRole;
}

/** Called by system-manager-service when an activation code is validated. */
export class ProvisionFromActivationDto {
  @IsUUID()
  activationCodeId: string;

  @IsString()
  @MinLength(8)
  adminPhoneNumber: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  clinicLocation: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  adminFullName: string;

  @IsOptional()
  @IsUUID()
  generatedBy?: string;
}

/** Called by user-service when a CLINIC_ADMIN finishes registration. */
export class LinkClinicAdminDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(8)
  phoneNumber: string;
}

export class VerifyStaffDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  userId: string;

  @IsEnum(StaffRole)
  staffRole: StaffRole;
}

export class CheckClinicAccessDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  userId: string;
}

/** Called by auth-service after staff creation or activation. */
export class EnsureStaffAssignmentDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  assignedBy: string;
}

export class ResolveStaffClinicDto {
  @IsUUID()
  userId: string;
}

export class ListStaffInternalDto {
  @IsUUID()
  clinicId: string;

  @IsOptional()
  @IsEnum(StaffRole)
  staffRole?: StaffRole;
}

export class ClinicSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  governorate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
