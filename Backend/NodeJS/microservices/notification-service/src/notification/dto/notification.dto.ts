import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

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
