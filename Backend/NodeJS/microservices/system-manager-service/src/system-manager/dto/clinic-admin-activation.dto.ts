import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class GenerateActivationCodeDto {
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
  clinicLocation: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsBoolean()
  isCashPaymentDone: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

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
