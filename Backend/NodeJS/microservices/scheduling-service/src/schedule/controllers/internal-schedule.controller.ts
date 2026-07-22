import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ScheduleService } from '../services/schedule.service';
import { ValidateSlotDto } from '../dto/schedule.dto';
import { InternalServiceGuard } from '../guards/internal-service.guard';

@Controller('v1/schedule/internal')
export class InternalScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('validate-slot')
  @UseGuards(InternalServiceGuard)
  async validateSlot(@Body() dto: ValidateSlotDto) {
    return this.scheduleService.validateSlot(dto);
  }

  @Get('clinics/:clinicId/hours')
  @UseGuards(InternalServiceGuard)
  async getClinicHours(@Param('clinicId', ParseUUIDPipe) clinicId: string) {
    const hours = await this.scheduleService.getClinicHours(clinicId, {
      userId: 'internal',
      role: 'SYSTEM_MANAGER',
    });
    return { success: true, hours };
  }
}
