import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ScheduleService } from '../services/schedule.service';
import {
  SetClinicHoursDto,
  CreateAvailabilityDto,
  CreateBlockDto,
  SlotsQueryDto,
} from '../dto/schedule.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { SkipTenantGuard } from '../../tenant-shared/tenant.decorators';
import { Roles } from '../decorators/roles.decorator';

@Controller('v1/schedule')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('slots')
  @SkipTenantGuard()
  async getSlots(@Query() query: SlotsQueryDto) {
    const result = await this.scheduleService.getSlots(query);
    return { success: true, ...result };
  }

  @Get('availability')
  async listAvailability(
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('doctorId') doctorId?: string,
  ) {
    const availability = await this.scheduleService.listAvailability(clinicId, doctorId);
    return { success: true, availability };
  }

  @Post('availability')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER')
  async createAvailability(@Body() dto: CreateAvailabilityDto, @Request() req) {
    const availability = await this.scheduleService.createAvailability(dto, req.user);
    return { success: true, availability };
  }

  @Post('blocked')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER')
  async createBlock(@Body() dto: CreateBlockDto, @Request() req) {
    const block = await this.scheduleService.createBlock(dto, req.user);
    return { success: true, block };
  }

  @Get('clinics/:clinicId/hours')
  async getClinicHours(@Param('clinicId', ParseUUIDPipe) clinicId: string) {
    const hours = await this.scheduleService.getClinicHours(clinicId);
    return { success: true, hours };
  }

  @Put('clinics/:clinicId/hours')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER')
  async setClinicHours(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() dto: SetClinicHoursDto,
    @Request() req,
  ) {
    const hours = await this.scheduleService.setClinicHours(clinicId, dto, req.user);
    return { success: true, hours };
  }
}
