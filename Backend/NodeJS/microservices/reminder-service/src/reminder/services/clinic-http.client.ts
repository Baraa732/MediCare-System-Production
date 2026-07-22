import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'reminder-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async getClinicName(clinicId: string): Promise<string> {
    try {
      const path = `/v1/clinics/internal/get-by-id/${clinicId}`;
      const res = await axios.post(`${this.baseUrl}${path}`, {}, {
        timeout: 5000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          {},
        ),
      });
      return res.data?.clinic?.name || 'the clinic';
    } catch (error) {
      this.logger.error(`getClinicName failed: ${error}`);
      return 'the clinic';
    }
  }
}
