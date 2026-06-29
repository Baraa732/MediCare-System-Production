import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PatientBookingAssistantDto {
  @ApiProperty({ description: 'Session identifier', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId: string;

  @ApiProperty({ description: 'User message', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;
}
