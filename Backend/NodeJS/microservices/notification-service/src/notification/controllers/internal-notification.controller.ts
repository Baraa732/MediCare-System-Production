import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { AppointmentReminderDto } from '../dto/notification.dto';
import { InternalServiceGuard } from '../guards/internal-service.guard';

@Controller('v1/notifications/internal')
export class InternalNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('appointment-reminder')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.OK)
  async sendAppointmentReminder(@Body() dto: AppointmentReminderDto) {
    const result = await this.notificationService.sendAppointmentReminder(dto);
    return { success: result.success };
  }
}
