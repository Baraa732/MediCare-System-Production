import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  async linkClinicAdmin(userId: string, phoneNumber: string): Promise<string | null> {
    if (!this.internalToken) {
      this.logger.warn('INTERNAL_SERVICE_TOKEN not set — skipping clinic admin link');
      return null;
    }

    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/link-admin`,
        { userId, phoneNumber },
        {
          timeout: 10000,
          headers: { 'x-service-token': this.internalToken },
        },
      );
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
