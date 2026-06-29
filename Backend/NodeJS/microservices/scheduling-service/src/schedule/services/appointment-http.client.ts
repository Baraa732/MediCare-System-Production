import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface BookedRange {
  start: string;
  end: string;
}

@Injectable()
export class AppointmentHttpClient {
  private readonly baseUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(AppointmentHttpClient.name);

  async getBookedRanges(
    clinicId: string,
    doctorId: string,
    date: string,
  ): Promise<BookedRange[]> {
    if (!this.token) return [];
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/appointments/internal/booked-ranges`,
        { clinicId, doctorId, date },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.ranges || [];
    } catch (error) {
      this.logger.warn(`getBookedRanges failed: ${error}`);
      return [];
    }
  }
}
