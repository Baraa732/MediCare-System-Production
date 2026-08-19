import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { PatientPushService } from '../services/patient-push.service';
import { StaffPushService } from '../services/staff-push.service';
import {
  AppointmentReminderDto,
  BroadcastDoctorsDto,
  BroadcastPatientsDto,
  NotifySystemManagersDto,
} from '../dto/notification.dto';
import { InternalServiceGuard } from '../guards/internal-service.guard';

@Controller('v1/notifications/internal')
export class InternalNotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly patientPushService: PatientPushService,
    private readonly staffPushService: StaffPushService,
  ) {}

  @Post('appointment-reminder')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder(@Body() dto: AppointmentReminderDto) {
    const result = await this.notificationService.sendAppointmentReminder(dto);
    return { success: result.success };
  }

  /** Platform owner broadcast — called by system-manager-service with patient ID batches. */
  @Post('broadcast-patients')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async broadcastPatients(@Body() dto: BroadcastPatientsDto) {
    const result = await this.patientPushService.broadcastSystemMessage(
      dto.userIds,
      dto.title.trim(),
      dto.body.trim(),
    );
    return { success: true, ...result };
  }

  /** Platform owner broadcast — called by system-manager-service with doctor ID batches. */
  @Post('broadcast-doctors')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async broadcastDoctors(@Body() dto: BroadcastDoctorsDto) {
    const result = await this.staffPushService.broadcastDoctorSystemMessage(
      dto.userIds,
      dto.title.trim(),
      dto.body.trim(),
    );
    return { success: true, ...result };
  }

  /** Platform operations inbox — called by system-manager-service for all system managers. */
  @Post('system-managers')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async notifySystemManagers(@Body() dto: NotifySystemManagersDto) {
    const result = await this.staffPushService.notifySystemManagers(dto);
    return { success: true, ...result };
  }
}
