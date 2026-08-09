import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppointmentService } from '../services/appointment.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from '../dto/appointment.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { SkipTenantGuard, SkipTenantAuthorization } from '../../tenant-shared/tenant.decorators';
import { TenantAuthorizationGuard } from '../../tenant-shared/tenant-authorization.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('v1/appointments')
@UseGuards(JwtAuthGuard, TenantGuard, TenantAuthorizationGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT', 'SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  async create(@Body() dto: CreateAppointmentDto, @Request() req) {
    const appointment = await this.appointmentService.create(dto, req.user);
    return {
      success: true,
      appointment: await this.appointmentService.toPublicEnriched(appointment),
    };
  }

  @Get('me')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async findMine(@Query() query: PatientAppointmentQueryDto, @Request() req) {
    const appointments = await this.appointmentService.findMine(req.user, query);
    return {
      success: true,
      appointments: await this.appointmentService.toPublicEnrichedMany(appointments),
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'DOCTOR', 'SYSTEM_MANAGER')
  async findAll(@Query() query: AppointmentQueryDto, @Request() req) {
    const appointments = await this.appointmentService.findAll(req.user, query);
    return {
      success: true,
      appointments: await this.appointmentService.toPublicEnrichedMany(appointments),
    };
  }

  @Get(':id')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT', 'SECRETARY', 'CLINIC_ADMIN', 'DOCTOR', 'SYSTEM_MANAGER')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const appointment = await this.appointmentService.findOne(id, req.user);
    return {
      success: true,
      appointment: await this.appointmentService.toPublicEnriched(appointment),
    };
  }

  @Put(':id')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT', 'SECRETARY', 'CLINIC_ADMIN', 'DOCTOR', 'SYSTEM_MANAGER')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @Request() req,
  ) {
    const appointment = await this.appointmentService.update(id, dto, req.user);
    return {
      success: true,
      appointment: await this.appointmentService.toPublicEnriched(appointment),
    };
  }

  @Patch(':id/status')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT', 'SECRETARY', 'CLINIC_ADMIN', 'DOCTOR', 'SYSTEM_MANAGER')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @Request() req,
  ) {
    const appointment = await this.appointmentService.updateStatus(id, dto, req.user);
    return {
      success: true,
      appointment: await this.appointmentService.toPublicEnriched(appointment),
    };
  }
}
