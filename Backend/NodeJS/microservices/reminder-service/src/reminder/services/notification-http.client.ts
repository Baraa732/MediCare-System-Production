import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { TENANT_HEADER } from '../../tenant-shared/tenant.constants';

export interface ReminderSendPayload {
  appointmentId: string;
  patientId?: string;
  tenantId?: string;
  phoneNumber: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicName: string;
}

@Injectable()
export class NotificationHttpClient {
  private readonly logger = new Logger(NotificationHttpClient.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  private headers(tenantId?: string): Record<string, string> {
    const h: Record<string, string> = { 'x-service-token': this.internalToken };
    if (tenantId) h[TENANT_HEADER] = tenantId;
    return h;
  }

  async sendAppointmentReminder(payload: ReminderSendPayload): Promise<boolean> {
    if (!this.internalToken) return false;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/notifications/internal/appointment-reminder`,
        payload,
        { timeout: 15000, headers: this.headers(payload.tenantId) },
      );
      return res.data?.success === true;
    } catch (error) {
      this.logger.error(`sendAppointmentReminder failed: ${error}`);
      return false;
    }
  }
}
