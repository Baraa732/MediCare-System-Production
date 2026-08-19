import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}

export class UnregisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}

export class AppointmentReminderDto {
  @IsUUID()
  appointmentId: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsString()
  @IsNotEmpty()
  doctorName: string;

  @IsString()
  @IsNotEmpty()
  appointmentDate: string;

  @IsString()
  @IsNotEmpty()
  appointmentTime: string;

  @IsString()
  @IsNotEmpty()
  clinicName: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;
}

export class BroadcastPatientsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class BroadcastDoctorsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  userIds: string[];
}

export class NotifySystemManagersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deepLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  dedupeKey?: string;

  @IsOptional()
  @IsUUID('4')
  clinicId?: string;
}
