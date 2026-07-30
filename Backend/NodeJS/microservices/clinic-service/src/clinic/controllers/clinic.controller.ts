import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClinicService } from '../services/clinic.service';
import { CreateClinicDto, UpdateClinicDto, AssignStaffDto, ClinicSearchQueryDto } from '../dto/clinic.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ClinicStatus } from '../entities/clinic.entity';
import { StaffRole } from '../entities/clinic-staff-assignment.entity';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { SkipTenantGuard, SkipTenantAuthorization } from '../../tenant-shared/tenant.decorators';
import { TenantAuthorizationGuard } from '../../tenant-shared/tenant-authorization.guard';

@Controller('v1/clinics')
@UseGuards(JwtAuthGuard, TenantGuard, TenantAuthorizationGuard)
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  /** Manual creation — system manager only. Clinic admins get a clinic via activation code. */
  @Post()
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER')
  async create(@Body() dto: CreateClinicDto, @Request() req) {
    const clinic = await this.clinicService.create(dto, req.user);
    return { success: true, clinic: this.clinicService.toPublicClinic(clinic) };
  }

  @Get()
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  async findAll(@Request() req, @Query('status') status?: ClinicStatus) {
    const clinics = await this.clinicService.findAll(req.user, status);
    return {
      success: true,
      clinics: clinics.map((c) => this.clinicService.toPublicClinic(c)),
    };
  }

  @Get('search')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  async search(@Request() req, @Query() query: ClinicSearchQueryDto) {
    const page = Math.max(parseInt(String(query['page'] || '1'), 10) || 1, 1);
    const limit = Math.min(parseInt(String(query['limit'] || '20'), 10) || 20, 100);
    const result = await this.clinicService.search(
      req.user,
      {
        q: query.q,
        city: query.city,
        governorate: query.governorate,
        specialization: query.specialization,
      },
      page,
      limit,
    );
    return {
      success: true,
      clinics: result.clinics.map((c) => this.clinicService.toPublicClinic(c)),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit) || 0,
      },
    };
  }

  @Get('users/:userId')
  async listClinicsForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
    @Query('staffRole') staffRole?: StaffRole,
  ) {
    const clinics = await this.clinicService.listClinicsForUser(userId, req.user, staffRole);
    return { success: true, clinics };
  }

  /** Current user's clinic assignments (secretary / clinic admin dashboards). */
  @Get('me')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  async getMyClinics(@Request() req, @Query('staffRole') staffRole?: StaffRole) {
    const clinics = await this.clinicService.listClinicsForUser(
      req.user.userId,
      req.user,
      staffRole,
    );
    return { success: true, clinics };
  }

  @Get('logos/:id')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  async getLogo(@Param('id', ParseUUIDPipe) id: string) {
    const { buffer, mime } = await this.clinicService.readLogo(id);
    return new StreamableFile(buffer, {
      type: mime,
      disposition: 'inline',
    });
  }

  @Get(':id/profile')
  @SkipTenantAuthorization()
  async getProfile(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const profile = await this.clinicService.getClinicProfile(id, req.user);
    return { success: true, ...profile };
  }

  @Get(':id')
  @SkipTenantAuthorization()
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const clinic = await this.clinicService.findOne(id, req.user);
    return { success: true, clinic: this.clinicService.toPublicClinic(clinic) };
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicDto,
    @Request() req,
  ) {
    const clinic = await this.clinicService.update(id, dto, req.user);
    return { success: true, clinic: this.clinicService.toPublicClinic(clinic) };
  }

  @Post(':id/logo')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer; size: number; mimetype: string },
    @Request() req,
  ) {
    const clinic = await this.clinicService.updateLogo(id, file, req.user);
    return { success: true, clinic: this.clinicService.toPublicClinic(clinic) };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    await this.clinicService.remove(id, req.user);
    return { success: true };
  }

  @Get(':id/staff')
  async listStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Query('staffRole') staffRole?: StaffRole,
  ) {
    const staff = await this.clinicService.listStaff(id, req.user, staffRole);
    return { success: true, staff };
  }

  @Get(':id/doctors')
  @SkipTenantAuthorization()
  async listDoctors(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const doctors = await this.clinicService.listDoctors(id, req.user);
    return { success: true, doctors };
  }

  @Post(':id/staff')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  async assignStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignStaffDto,
    @Request() req,
  ) {
    const assignment = await this.clinicService.assignStaff(id, dto, req.user);
    return { success: true, assignment };
  }

  @Delete(':id/staff/:userId')
  @UseGuards(RolesGuard)
  @Roles('SYSTEM_MANAGER', 'CLINIC_ADMIN')
  @HttpCode(HttpStatus.OK)
  async removeStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    return this.clinicService.removeStaff(id, userId, req.user);
  }
}
