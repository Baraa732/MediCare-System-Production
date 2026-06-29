import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  private headers(): Record<string, string> {
    return { 'x-service-token': this.internalToken };
  }

  async getClinicName(clinicId: string): Promise<string> {
    if (!this.internalToken) return 'the clinic';
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/get-by-id/${clinicId}`,
        {},
        { timeout: 5000, headers: this.headers() },
      );
      return res.data?.clinic?.name || 'the clinic';
    } catch (error) {
      this.logger.error(`getClinicName failed: ${error}`);
      return 'the clinic';
    }
  }
}
