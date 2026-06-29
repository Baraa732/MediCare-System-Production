import {
  IsString, IsEmail, IsEnum, IsOptional, MinLength, IsInt, Min, IsIn, IsDateString,
} from 'class-validator';
import { UserRole } from '../entities/user.enums';

export class CreateUserByAdminDto {
  // Account
  @IsString()
  @IsOptional()
  @MinLength(3)
  username?: string;

  @IsString()
  phoneNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  // Personal
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

  // Location
  @IsString()
  @IsOptional()
  governorate?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  streetInfo?: string;

  // Role & clinic
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
