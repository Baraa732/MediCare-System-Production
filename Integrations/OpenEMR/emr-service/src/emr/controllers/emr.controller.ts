import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { TenantAuthorizationGuard } from '../../tenant-shared/tenant-authorization.guard';
import { DoctorPatientAccessGuard } from '../../tenant-shared/doctor-patient-access.guard';
import { DoctorPatientParam } from '../../tenant-shared/tenant.decorators';
import {
  SkipTenantAuthorization,
  SkipTenantGuard,
} from '../../tenant-shared/tenant.decorators';
import { EmrRecordService } from '../services/emr-record.service';

const STAFF_ROLES = ['DOCTOR', 'CLINIC_ADMIN', 'SYSTEM_MANAGER'];

interface AuthUser {
  userId: string;
  role: string;
}

@Controller('v1/emr')
@UseGuards(JwtAuthGuard, TenantGuard, TenantAuthorizationGuard)
export class EmrController {
  constructor(private emrRecordService: EmrRecordService) {}

  private preferredTenant(
    query: { tenantId?: string; clinicId?: string },
  ): string | undefined {
    return query.tenantId || query.clinicId || undefined;
  }

  /** Patient self-chart — FHIR-aligned patient portal entry. */
  @Get('me')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async getMyEmr(
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
  ) {
    return this.emrRecordService.getMyEmr(req.user, this.preferredTenant(query));
  }

  /** Docs / client alias for GET /me */
  @Get('my-chart')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async getMyChart(
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
  ) {
    return this.emrRecordService.getMyEmr(req.user, this.preferredTenant(query));
  }

  @Get('me/sync-status')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async getMySyncStatus(
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
  ) {
    return this.emrRecordService.getMySyncStatus(req.user, this.preferredTenant(query));
  }

  /** Docs / client alias for GET /me/sync-status */
  @Get('sync-status')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async getSyncStatusAlias(
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
  ) {
    return this.emrRecordService.getMySyncStatus(req.user, this.preferredTenant(query));
  }

  @Get('me/links')
  @SkipTenantGuard()
  @SkipTenantAuthorization()
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async listMyLinks(@Request() req: { user: AuthUser }) {
    return this.emrRecordService.listMyLinks(req.user);
  }

  @Get('patients/:userId')
  @UseGuards(DoctorPatientAccessGuard)
  @DoctorPatientParam('userId')
  async getPatientEmr(
    @Param('userId') userId: string,
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
  ) {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwnRecord = req.user.role === 'PATIENT' && req.user.userId === userId;

    if (!isStaff && !isOwnRecord) {
      throw new ForbiddenException('You can only access your own EMR record');
    }

    if (isOwnRecord) {
      return this.emrRecordService.getMyEmr(req.user, this.preferredTenant(query));
    }

    return this.emrRecordService.getPatientEmr(
      userId,
      req.user,
      this.preferredTenant(query),
    );
  }

  @Post('patients/:userId/ensure')
  @UseGuards(RolesGuard, DoctorPatientAccessGuard)
  @Roles(...STAFF_ROLES)
  @DoctorPatientParam('userId')
  async ensurePatientEmr(
    @Param('userId') userId: string,
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
    @Body()
    body?: {
      phoneNumber?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: string;
      birthDate?: string;
    },
  ) {
    return this.emrRecordService.ensurePatientEmr(
      userId,
      req.user,
      this.preferredTenant(query),
      body,
    );
  }

  @Post('patients/:userId/clinical-notes')
  @UseGuards(RolesGuard, DoctorPatientAccessGuard)
  @Roles(...STAFF_ROLES)
  @DoctorPatientParam('userId')
  async addClinicalNote(
    @Param('userId') userId: string,
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
    @Body() body: { content: string; type?: string },
  ) {
    return this.emrRecordService.addClinicalNote(
      userId,
      req.user,
      body,
      this.preferredTenant(query),
    );
  }

  @Get('patients/:userId/sync-status')
  @UseGuards(DoctorPatientAccessGuard)
  @DoctorPatientParam('userId')
  async getPatientSyncStatus(
    @Param('userId') userId: string,
    @Request() req: { user: AuthUser },
    @Query() query: { tenantId?: string; clinicId?: string },
  ) {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwnRecord = req.user.role === 'PATIENT' && req.user.userId === userId;

    if (!isStaff && !isOwnRecord) {
      throw new ForbiddenException('You can only access your own EMR sync status');
    }

    return this.emrRecordService.getSyncStatus(
      userId,
      req.user,
      this.preferredTenant(query),
    );
  }
}
