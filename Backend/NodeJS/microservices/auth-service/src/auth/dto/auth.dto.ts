import {
  IsString, IsEmail, IsEnum, IsOptional, MinLength, Matches, IsInt, Min, IsIn, IsDateString,
} from 'class-validator';
import { UserRole } from '../decorators/roles.decorator';
import { IsValidPhoneNumber } from '../decorators/phone.decorator';

// Password must be 8+ chars with at least one uppercase, one lowercase, one digit, one special char.
// This regex is intentionally strict for a healthcare system handling PHI.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

export class RegisterDto {
  @IsValidPhoneNumber()
  phoneNumber: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

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
  middleName?: string;

  @IsString()
  @IsOptional()
  nationalId?: string;

  @IsString()
  @IsOptional()
  motherName?: string;

  @IsString()
  @IsOptional()
  motherLastName?: string;

  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  birthPlace?: string;

  @IsIn(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'])
  @IsOptional()
  maritalStatus?: string;

  @IsString()
  @IsOptional()
  healthStatus?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  governorate?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  streetInfo?: string;
}

export class SendOtpDto {
  @IsValidPhoneNumber()
  phoneNumber: string;
}

export class VerifyOtpDto {
  @IsValidPhoneNumber()
  phoneNumber: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsOptional()
  @IsString()
  autoLogin?: string; // 'true' or 'false' as string for query parameter support
}

export class LoginDto {
  @IsValidPhoneNumber()
  phoneNumber: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  browserFingerprint?: string;
}

export class CreateUserByAdminDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  username?: string;

  @IsValidPhoneNumber()
  phoneNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @IsOptional()
  middleName?: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  @IsOptional()
  nationalId?: string;

  @IsString()
  @IsOptional()
  motherName?: string;

  @IsString()
  @IsOptional()
  motherLastName?: string;

  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  birthPlace?: string;

  @IsIn(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'])
  @IsOptional()
  maritalStatus?: string;

  @IsString()
  @IsOptional()
  healthStatus?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  governorate?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  streetInfo?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsOptional()
  clinicId?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;
}

export class CompleteStaffActivationDto {
  @IsString()
  activationToken: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  browserFingerprint?: string;
}

export class VerifyMfaDto {
  @IsString()
  mfaToken: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  browserFingerprint?: string;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  // Role removed to prevent privilege escalation - use separate ChangeRoleDto endpoint restricted to SYSTEM_MANAGER
  @IsString()
  @IsOptional()
  clinicId?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class ResetPasswordDto {
  @IsValidPhoneNumber()
  phoneNumber: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  browserFingerprint?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsString()
  @IsOptional()
  // Deprecated: JTI now comes from authenticated request context.
  // Kept temporarily for backward compatibility with older clients.
  jti?: string;
}

export class RevokeSessionDto {
  @IsString()
  sessionId: string;
}

export class ActivateClinicAdminDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Activation code must be 6 digits' })
  code: string;

  @IsValidPhoneNumber()
  phoneNumber: string;
}