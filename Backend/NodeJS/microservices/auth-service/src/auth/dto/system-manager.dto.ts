import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class SystemManagerLoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class CreateClinicAdminDto {
  @IsString()
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
  @MinLength(6)
  password: string;

  @IsString()
  clinicId: string;
}
