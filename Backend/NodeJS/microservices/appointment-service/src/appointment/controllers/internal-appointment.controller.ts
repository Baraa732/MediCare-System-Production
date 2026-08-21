import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { AppointmentService } from '../services/appointment.service';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { VerifyOwnershipDto } from '../dto/internal.dto';

class CheckDoctorPatientDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  doctorId: string;

  @IsUUID()
  patientId: string;
}

class CheckPatientClinicDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  clinicId: string;
}

class BookedRangesDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  doctorId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  excludeAppointmentId?: string;
}

class CancelInRangeDto {
  @IsUUID()
  clinicId: string;

  @IsDateString()
  fromIso: string;

  @IsDateString()
  toIso: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsString()
  reason: string;

  @IsUUID()
  actorUserId: string;
}

class VerifyAppointmentEventDto {
  @IsUUID()
  appointmentId: string;

  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

@Controller('v1/appointments/internal')
export class InternalAppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post('check-doctor-patient')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async checkDoctorPatient(@Body() dto: CheckDoctorPatientDto) {
    const allowed = await this.appointmentService.hasDoctorPatientAccess(
      dto.clinicId,
      dto.doctorId,
      dto.patientId,
    );
    return { allowed };
  }

  @Post('check-patient-clinic')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async checkPatientClinic(@Body() dto: CheckPatientClinicDto) {
    const allowed = await this.appointmentService.hasPatientClinicAccess(
      dto.patientId,
      dto.clinicId,
    );
    return { allowed };
  }

  @Post('booked-ranges')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async getBookedRanges(@Body() dto: BookedRangesDto) {
    const ranges = await this.appointmentService.getBookedRangesForDay(
      dto.clinicId,
      dto.doctorId,
      dto.date,
      dto.excludeAppointmentId,
    );
    return { success: true, ranges };
  }

  @Post('cancel-in-range')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async cancelInRange(@Body() dto: CancelInRangeDto) {
    const result = await this.appointmentService.cancelInRange({
      clinicId: dto.clinicId,
      fromIso: dto.fromIso,
      toIso: dto.toIso,
      doctorId: dto.doctorId,
      reason: dto.reason,
      actorUserId: dto.actorUserId,
    });
    return { success: true, ...result };
  }

  @Post('patient-upcoming-summary')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async patientUpcomingSummary(@Body() body: { patientId: string; limit?: number }) {
    const summary = await this.appointmentService.getPatientUpcomingSummary(
      body.patientId,
      body.limit ?? 3,
    );
    return { success: true, summary };
  }

  @Post('verify-ownership')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async verifyOwnership(
    @Headers('x-patient-id') patientId: string,
    @Body() dto: VerifyOwnershipDto,
  ) {
    if (!patientId) {
      throw new BadRequestException('x-patient-id header is required');
    }
    const owned = await this.appointmentService.verifyOwnership(patientId, dto.appointmentId);
    return { success: true, owned };
  }

  @Post('verify-event')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async verifyEvent(@Body() dto: VerifyAppointmentEventDto) {
    const valid = await this.appointmentService.verifyKafkaEvent(dto);
    return { valid };
  }
}
