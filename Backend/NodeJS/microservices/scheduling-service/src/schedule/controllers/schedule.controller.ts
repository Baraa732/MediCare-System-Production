import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ScheduleService } from '../services/schedule.service';
import {
  SetClinicHoursDto,
  CreateAvailabilityDto,
  CreateBlockDto,
  CloseClinicDayDto,
  SlotsQueryDto,
} from '../dto/schedule.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { SkipTenantGuard, SkipTenantAuthorization } from '../../tenant-shared/tenant.decorators';
import { TenantAuthorizationGuard } from '../../tenant-shared/tenant-authorization.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('v1/schedule')
@UseGuards(JwtAuthGuard, TenantGuard, TenantAuthorizationGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  private actor(req: { user: { userId: string; role: string; tenantId?: string; clinicId?: string }; headers: Record<string, unknown> }) {
    const headerTenant = req.headers['x-tenant-id'];
    const fromHeader = typeof headerTenant === 'string' ? headerTenant : undefined;
    return {
      userId: req.user.userId,
      role: req.user.role,
      tenantId: req.user.tenantId || req.user.clinicId || fromHeader,
      clinicId: req.user.clinicId || req.user.tenantId || fromHeader,
    };
  }

  @Get('slots')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  async getSlots(@Query() query: SlotsQueryDto) {
    const result = await this.scheduleService.getSlots(query);
    return { success: true, ...result };
  }

  @Get('availability')
  @SkipTenantAuthorization()
  async listAvailability(
    @Query('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('doctorId') doctorId: string | undefined,
    @Request() req,
  ) {
    const availability = await this.scheduleService.listAvailability(clinicId, doctorId, this.actor(req));
    return { success: true, availability };
  }

  @Post('availability')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER')
  async createAvailability(@Body() dto: CreateAvailabilityDto, @Request() req) {
    const availability = await this.scheduleService.createAvailability(dto, this.actor(req));
    return { success: true, availability };
  }

  @Post('blocked')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'DOCTOR', 'SYSTEM_MANAGER')
  async createBlock(@Body() dto: CreateBlockDto, @Request() req) {
    const result = await this.scheduleService.createBlock(dto, this.actor(req));
    return { success: true, ...result };
  }

  @Patch('blocked/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SYSTEM_MANAGER')
  async approveBlock(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const result = await this.scheduleService.reviewBlock(id, 'APPROVED', this.actor(req));
    return { success: true, ...result };
  }

  @Patch('blocked/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SYSTEM_MANAGER')
  async rejectBlock(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const result = await this.scheduleService.reviewBlock(id, 'REJECTED', this.actor(req));
    return { success: true, ...result };
  }

  @Post('clinics/:clinicId/close-day')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER')
  async closeClinicDay(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() dto: CloseClinicDayDto,
    @Request() req,
  ) {
    const result = await this.scheduleService.closeClinicDay(clinicId, dto, this.actor(req));
    return { success: true, ...result };
  }

  @Post('clinics/:clinicId/open-day')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'SYSTEM_MANAGER')
  async openClinicDay(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() dto: CloseClinicDayDto,
    @Request() req,
  ) {
    const result = await this.scheduleService.openClinicDay(clinicId, dto, this.actor(req));
    return { success: true, ...result };
  }

  /** Tenant-scoped leave list: clinic comes from the doctor's JWT membership. */
  @Get('me/blocked')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'DOCTOR', 'SYSTEM_MANAGER')
  async listMyBlocks(@Request() req) {
    const blocks = await this.scheduleService.listMyBlocks(this.actor(req));
    return { success: true, blocks };
  }

  @Get('blocked')
  @UseGuards(RolesGuard)
  @Roles('CLINIC_ADMIN', 'SECRETARY', 'DOCTOR', 'SYSTEM_MANAGER')
  async listBlocks(
    @Query('clinicId') clinicId: string | undefined,
    @Query('doctorId') doctorId: string | undefined,
    @Request() req,
  ) {
    const blocks = await this.scheduleService.listBlocks(clinicId, doctorId, this.actor(req));
    return { success: true, blocks };
  }

  @Get('clinics/:clinicId/hours')
  @SkipTenantAuthorization()
  async getClinicHours(@Param('clinicId', ParseUUIDPipe) clinicId: string, @Request() req) {
    const hours = await this.scheduleService.getClinicHours(clinicId, this.actor(req));
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
    const result = await this.scheduleService.setClinicHours(clinicId, dto, this.actor(req));
    return { success: true, hours: result.hours, cancelledCount: result.cancelledCount };
  }
}
