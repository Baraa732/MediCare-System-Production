import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PatientBookingSessionDto {
  @ApiPropertyOptional({ description: 'Optional legacy resume token', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resumeToken?: string;
}
