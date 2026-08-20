import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface BookedRange {
  start: string;
  end: string;
}

@Injectable()
export class AppointmentHttpClient {
  private readonly baseUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly serviceName = 'scheduling-service';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
  private readonly logger = new Logger(AppointmentHttpClient.name);

  constructor() {
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async getBookedRanges(
    clinicId: string,
    doctorId: string,
    date: string,
    excludeAppointmentId?: string,
  ): Promise<BookedRange[]> {
    try {
      const path = '/v1/appointments/internal/booked-ranges';
      const body = { clinicId, doctorId, date, excludeAppointmentId };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 5000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          body,
        ),
      });
      return res.data?.ranges || [];
    } catch (error) {
      this.logger.warn(`getBookedRanges failed: ${error}`);
      return [];
    }
  }
}
