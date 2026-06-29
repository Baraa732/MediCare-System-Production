import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SchedulingHttpClient {
  private readonly baseUrl = process.env.SCHEDULING_SERVICE_URL || 'http://scheduling-service:3008';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(SchedulingHttpClient.name);

  async getClinicHours(clinicId: string): Promise<unknown[]> {
    if (!this.token) return [];
    try {
      const res = await axios.get(
        `${this.baseUrl}/v1/schedule/internal/clinics/${clinicId}/hours`,
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.hours || [];
    } catch (error) {
      this.logger.warn(`getClinicHours failed: ${error}`);
      return [];
    }
  }
}
