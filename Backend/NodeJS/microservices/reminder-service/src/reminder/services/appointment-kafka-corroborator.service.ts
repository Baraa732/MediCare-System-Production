import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';
import { KafkaTenantCorroborator } from '../../kafka-security-shared/secured-kafka.consumer';

@Injectable()
export class AppointmentKafkaCorroborator implements KafkaTenantCorroborator {
  private readonly logger = new Logger(AppointmentKafkaCorroborator.name);
  private readonly baseUrl =
    process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly serviceName =
    process.env.INTERNAL_AUTH_SERVICE_NAME || process.env.SERVICE_NAME || 'reminder-service';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';

  async corroborateTenant(
    topic: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!topic.startsWith('appointment.')) return true;

    const appointmentId = payload.appointmentId;
    if (typeof appointmentId !== 'string') return false;

    const body = {
      appointmentId,
      tenantId,
      patientId: typeof payload.patientId === 'string' ? payload.patientId : undefined,
      doctorId: typeof payload.doctorId === 'string' ? payload.doctorId : undefined,
      status: typeof payload.status === 'string' ? payload.status : undefined,
    };

    try {
      const url = `${this.baseUrl}/v1/appointments/internal/verify-event`;
      const headers = createInternalAuthHeadersForUrl(
        this.serviceName,
        this.signingSecret,
        'POST',
        url,
        body,
      );
      const response = await axios.post<{ valid: boolean }>(url, body, {
        headers,
        timeout: 5000,
        validateStatus: () => true,
      });
      return response.status === 200 && response.data?.valid === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Appointment corroboration failed for ${appointmentId}: ${message}`);
      return false;
    }
  }
}
