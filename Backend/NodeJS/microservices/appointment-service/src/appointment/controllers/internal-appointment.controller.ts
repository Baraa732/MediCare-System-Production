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
import { IsDateString, IsUUID } from 'class-validator';
import { AppointmentService } from '../services/appointment.service';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { VerifyOwnershipDto } from '../dto/internal.dto';

class BookedRangesDto {
  @IsUUID()
  clinicId: string;

  @IsUUID()
  doctorId: string;

  @IsDateString()
  date: string;
}

@Controller('v1/appointments/internal')
export class InternalAppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post('booked-ranges')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async getBookedRanges(@Body() dto: BookedRangesDto) {
    const ranges = await this.appointmentService.getBookedRangesForDay(
      dto.clinicId,
      dto.doctorId,
      dto.date,
    );
    return { success: true, ranges };
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
}
