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
import { EmrRecordService } from '../services/emr-record.service';

const STAFF_ROLES = ['DOCTOR', 'CLINIC_ADMIN', 'SYSTEM_MANAGER'];

@Controller('v1/emr')
@UseGuards(JwtAuthGuard)
export class EmrController {
  constructor(private emrRecordService: EmrRecordService) {}

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  async getMyEmr(@Request() req: { user: { userId: string } }) {
    return this.emrRecordService.getPatientEmr(req.user.userId);
  }

  @Get('me/sync-status')
  async getMySyncStatus(@Request() req: { user: { userId: string; role: string } }) {
    if (req.user.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can use /me/sync-status');
    }
    return this.emrRecordService.getSyncStatus(req.user.userId);
  }

  @Get('patients/:userId')
  async getPatientEmr(
    @Param('userId') userId: string,
    @Request() req: { user: { userId: string; role: string } },
  ) {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwnRecord = req.user.role === 'PATIENT' && req.user.userId === userId;

    if (!isStaff && !isOwnRecord) {
      throw new ForbiddenException('You can only access your own EMR record');
    }

    return this.emrRecordService.getPatientEmr(userId);
  }

  @Get('patients/:userId/sync-status')
  async getPatientSyncStatus(
    @Param('userId') userId: string,
    @Request() req: { user: { userId: string; role: string } },
  ) {
    const isStaff = STAFF_ROLES.includes(req.user.role);
    const isOwnRecord = req.user.role === 'PATIENT' && req.user.userId === userId;

    if (!isStaff && !isOwnRecord) {
      throw new ForbiddenException('You can only access your own EMR sync status');
    }

    return this.emrRecordService.getSyncStatus(userId);
  }
}
