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

  async cancelInRange(params: {
    clinicId: string;
    fromIso: string;
    toIso: string;
    doctorId?: string | null;
    reason: string;
    actorUserId: string;
  }): Promise<number> {
    try {
      const path = '/v1/appointments/internal/cancel-in-range';
      const body = {
        clinicId: params.clinicId,
        fromIso: params.fromIso,
        toIso: params.toIso,
        reason: params.reason,
        actorUserId: params.actorUserId,
        ...(params.doctorId ? { doctorId: params.doctorId } : {}),
      };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 30_000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          body,
        ),
      });
      return Number(res.data?.cancelledCount ?? 0);
    } catch (error) {
      this.logger.error(`cancelInRange failed: ${error}`);
      return 0;
    }
  }
}
