import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SetClinicHoursDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  openTime?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class CreateAvailabilityDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  doctorId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDurationMinutes?: number;
}

export class CreateBlockDto {
  @IsUUID()
  clinicId: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SlotsQueryDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  doctorId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  durationMinutes?: number;
}

export class ValidateSlotDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  doctorId: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;
}
