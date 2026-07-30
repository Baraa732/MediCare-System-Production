import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { StaffPushService } from '../services/staff-push.service';
import { PatientPushService } from '../services/patient-push.service';
import { FirebasePushService } from '../services/firebase-push.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../../tenant-shared/tenant.guard';
import { TenantAuthorizationGuard } from '../../tenant-shared/tenant-authorization.guard';
import { SkipTenantGuard } from '../../tenant-shared/tenant.decorators';
import { Roles } from '../decorators/roles.decorator';
import { RegisterPushDeviceDto, UnregisterPushDeviceDto } from '../dto/notification.dto';

@Controller('v1/notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly staffPushService: StaffPushService,
    private readonly patientPushService: PatientPushService,
    private readonly firebasePushService: FirebasePushService,
  ) {}

  /** Public Firebase web config for service worker + client SDK (safe to expose). */
  @Get('push/web-config')
  @SkipTenantGuard()
  getWebPushConfig() {
    const config = this.firebasePushService.getWebConfig();
    if (!config) {
      return { success: false, configured: false, config: null };
    }
    return { success: true, configured: true, config };
  }

  @Post('patient/push/register')
  @SkipTenantGuard()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @HttpCode(HttpStatus.OK)
  async registerPatientPushDevice(
    @Request() req: { user: { userId: string } },
    @Body() dto: RegisterPushDeviceDto,
  ) {
    await this.patientPushService.registerDevice(
      req.user.userId,
      dto.fcmToken,
      dto.platform ?? 'android',
      dto.deviceLabel,
    );
    return { success: true, message: 'Patient device registered for push notifications.' };
  }

  @Delete('patient/push/register')
  @SkipTenantGuard()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @HttpCode(HttpStatus.OK)
  async unregisterPatientPushDevice(
    @Request() req: { user: { userId: string } },
    @Body() dto: UnregisterPushDeviceDto,
  ) {
    await this.patientPushService.unregisterDevice(req.user.userId, dto.fcmToken);
    return { success: true };
  }

  @Post('push/register')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantAuthorizationGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  @HttpCode(HttpStatus.OK)
  async registerPushDevice(
    @Request() req: { user: { userId: string } },
    @Body() dto: RegisterPushDeviceDto,
  ) {
    await this.staffPushService.registerDevice(
      req.user.userId,
      dto.fcmToken,
      dto.platform,
      dto.deviceLabel,
    );
    return { success: true, message: 'Device registered for push notifications.' };
  }

  @Delete('push/register')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantAuthorizationGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  @HttpCode(HttpStatus.OK)
  async unregisterPushDevice(
    @Request() req: { user: { userId: string } },
    @Body() dto: UnregisterPushDeviceDto,
  ) {
    await this.staffPushService.unregisterDevice(req.user.userId, dto.fcmToken);
    return { success: true };
  }

  @Get('staff/inbox')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantAuthorizationGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  async getStaffInbox(
    @Request() req: { user: { userId: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.staffPushService.listInbox(req.user.userId, {
      page: Math.max(parseInt(page, 10) || 1, 1),
      limit: Math.min(parseInt(limit, 10) || 20, 50),
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch('staff/inbox/:id/read')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantAuthorizationGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  @HttpCode(HttpStatus.OK)
  async markStaffInboxRead(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.staffPushService.markRead(req.user.userId, id);
    return { success: true };
  }

  @Patch('staff/inbox/read-all')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, TenantAuthorizationGuard)
  @Roles('SECRETARY', 'CLINIC_ADMIN', 'SYSTEM_MANAGER')
  @HttpCode(HttpStatus.OK)
  async markAllStaffInboxRead(@Request() req: { user: { userId: string } }) {
    await this.staffPushService.markAllRead(req.user.userId);
    return { success: true };
  }

  @Get('me')
  @SkipTenantGuard()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  async getMyNotifications(
    @Request() req: { user: { userId: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.patientPushService.listInbox(req.user.userId, {
      page: Math.max(parseInt(page, 10) || 1, 1),
      limit: Math.min(parseInt(limit, 10) || 20, 50),
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch('me/:id/read')
  @SkipTenantGuard()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @HttpCode(HttpStatus.OK)
  async markPatientNotificationRead(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    await this.patientPushService.markRead(req.user.userId, id);
    return { success: true };
  }

  @Patch('me/read-all')
  @SkipTenantGuard()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @HttpCode(HttpStatus.OK)
  async markAllPatientNotificationsRead(@Request() req: { user: { userId: string } }) {
    await this.patientPushService.markAllRead(req.user.userId);
    return { success: true };
  }
}
