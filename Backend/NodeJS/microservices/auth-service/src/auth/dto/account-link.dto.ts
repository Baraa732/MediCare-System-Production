import { IsString, IsNotEmpty } from 'class-validator';

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

export class SwitchRoleDto {
  @IsString()
  @IsNotEmpty()
  targetRole: string;

  @IsString()
  targetUserId?: string;
}
