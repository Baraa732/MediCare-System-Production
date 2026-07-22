import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

@Injectable()
export class SchedulingHttpClient {
  private readonly baseUrl = process.env.SCHEDULING_SERVICE_URL || 'http://scheduling-service:3008';
  private readonly serviceName = 'clinic-service';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
  private readonly logger = new Logger(SchedulingHttpClient.name);

  constructor() {
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async getClinicHours(clinicId: string): Promise<unknown[]> {
    try {
      const path = `/v1/schedule/internal/clinics/${clinicId}/hours`;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 5000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'GET',
          path,
        ),
      });
      return res.data?.hours || [];
    } catch (error) {
      this.logger.warn(`getClinicHours failed: ${error}`);
      return [];
    }
  }
}
