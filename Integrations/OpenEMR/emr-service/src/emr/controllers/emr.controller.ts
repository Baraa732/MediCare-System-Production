import {
  Controller,
  ForbiddenException,
  Get,
  Param,
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

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async getMyEmr(@Request() req: { user: AuthUser }) {
    return this.emrRecordService.getPatientEmr(req.user.userId, req.user);
  }

  @Get('me/sync-status')
  async getMySyncStatus(@Request() req: { user: AuthUser }) {
    if (req.user.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can use /me/sync-status');
    }
    return this.emrRecordService.getSyncStatus(req.user.userId, req.user);
  }

  @Get('patients/:userId')
  @UseGuards(DoctorPatientAccessGuard)
  @DoctorPatientParam('userId')
  async getPatientEmr(
    @Param('userId') userId: string,
    @Request() req: { user: AuthUser },
  ) {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwnRecord = req.user.role === 'PATIENT' && req.user.userId === userId;

    if (!isStaff && !isOwnRecord) {
      throw new ForbiddenException('You can only access your own EMR record');
    }

    return this.emrRecordService.getPatientEmr(userId, req.user);
  }

  @Get('patients/:userId/sync-status')
  @UseGuards(DoctorPatientAccessGuard)
  @DoctorPatientParam('userId')
  async getPatientSyncStatus(
    @Param('userId') userId: string,
    @Request() req: { user: AuthUser },
  ) {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwnRecord = req.user.role === 'PATIENT' && req.user.userId === userId;

    if (!isStaff && !isOwnRecord) {
      throw new ForbiddenException('You can only access your own EMR sync status');
    }

    return this.emrRecordService.getSyncStatus(userId, req.user);
  }
}
