import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class SummaryDto {
  @ApiProperty({ description: 'Clinical text to summarize', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text: string;
}

export class MedicalReportDto {
  @ApiPropertyOptional({ description: 'Patient demographic and clinical information' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  patientInfo?: string;

  @ApiPropertyOptional({ description: 'Laboratory test results' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  labResults?: string;

  @ApiPropertyOptional({ description: 'Physician notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  doctorNotes?: string;

  @ApiPropertyOptional({ description: 'Known diagnoses' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnoses?: string;
}

export class OcrCleanupDto {
  @ApiPropertyOptional({
    description: 'Raw OCR-extracted text (required if imageBase64 not provided)',
    maxLength: 20000,
  })
  @ValidateIf((o) => !o.imageBase64)
  @IsString()
  @IsNotEmpty({ message: 'rawText is required when imageBase64 is not provided' })
  @MaxLength(20000)
  rawText?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded document image — triggers OCR engine before AI cleanup',
    maxLength: 7000000,
  })
  @ValidateIf((o) => !o.rawText)
  @IsString()
  @IsNotEmpty({ message: 'imageBase64 is required when rawText is not provided' })
  @MaxLength(7000000)
  imageBase64?: string;

  @ApiPropertyOptional({
    description: 'Document type hint for structured extraction',
    example: 'lab_report',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentType?: string;
}

export class PatientChatDto {
  @ApiProperty({ description: 'Patient question', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string;

  @ApiPropertyOptional({ description: 'Optional context (appointments, medications, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  context?: string;
}

export class DoctorChatDto {
  @ApiProperty({ description: 'Physician question', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string;

  @ApiPropertyOptional({ description: 'Patient history and clinical context' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  patientContext?: string;
}

export class AppointmentNoteDto {
  @ApiProperty({ description: 'Brief doctor notes from the visit', maxLength: 5000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  notes: string;

  @ApiPropertyOptional({ description: 'Additional visit context' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;
}

export class ClinicalAssessmentDto {
  @ApiProperty({ description: 'Clinical data for assessment draft', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  data: string;
}

export class RecommendationsDto {
  @ApiProperty({ description: 'Clinical data for recommendations', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  data: string;
}
