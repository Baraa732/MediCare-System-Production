import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { TENANT_HEADER } from '../../tenant-shared/tenant.constants';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

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
  private readonly serviceName = 'reminder-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async sendAppointmentReminder(payload: ReminderSendPayload): Promise<boolean> {
    try {
      const path = '/v1/notifications/internal/appointment-reminder';
      const headers = createInternalAuthHeadersForUrl(
        this.serviceName,
        this.signingSecret,
        'POST',
        path,
        payload,
        payload.tenantId ? { [TENANT_HEADER]: payload.tenantId } : undefined,
      );
      const res = await axios.post(`${this.baseUrl}${path}`, payload, {
        timeout: 15000,
        headers,
      });
      return res.data?.success === true;
    } catch (error) {
      this.logger.error(`sendAppointmentReminder failed: ${error}`);
      return false;
    }
  }
}
