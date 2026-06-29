import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export interface ProvisionClinicPayload {
  activationCodeId: string;
  adminPhoneNumber: string;
  clinicLocation: string;
  adminFullName: string;
  generatedBy?: string;
}

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  private ensureToken(): void {
    if (!this.internalToken) {
      throw new Error('INTERNAL_SERVICE_TOKEN env var is not set');
    }
  }

  async provisionFromActivation(payload: ProvisionClinicPayload): Promise<{ clinicId: string }> {
    this.ensureToken();
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/provision-from-activation`,
        payload,
        {
          timeout: 10000,
          headers: { 'x-service-token': this.internalToken },
        },
      );
      return { clinicId: res.data.clinicId };
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`provisionFromActivation failed: ${msg}`);
      throw new ServiceUnavailableException(
        'Could not provision clinic. Please try again or contact support.',
      );
    }
  }
}
