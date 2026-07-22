import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'user-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async linkClinicAdmin(userId: string, phoneNumber: string): Promise<string | null> {
    try {
      const path = '/v1/clinics/internal/link-admin';
      const body = { userId, phoneNumber };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 10000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          body,
        ),
      });
      return res.data?.clinicId ?? null;
    } catch (error) {
      const msg = error instanceof AxiosError
        ? `${error.response?.status} ${error.response?.data?.error?.message || error.message}`
        : String(error);
      this.logger.error(`linkClinicAdmin failed for user ${userId}: ${msg}`);
      return null;
    }
  }
}
