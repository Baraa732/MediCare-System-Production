import { IsString, IsEnum, IsNotEmpty } from 'class-validator';

export class LinkPatientAccountDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  email?: string;
}

export class LinkAccountDto {
  @IsString()
  @IsNotEmpty()
  systemManagerId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(['PATIENT', 'DOCTOR', 'CLINIC_ADMIN', 'SECRETARY'])
  @IsNotEmpty()
  linkType: string;
}

export class SwitchRoleDto {
  @IsString()
  @IsNotEmpty()
  targetRole: string;

  @IsString()
  targetUserId?: string;
}
