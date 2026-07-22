import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

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
  private readonly serviceName = 'system-manager-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async createPlatformClinic(body: {
    name: string;
    description?: string;
    city?: string;
    governorate?: string;
    phone?: string;
    email?: string;
  }): Promise<{ success: boolean; clinic: Record<string, unknown> }> {
    try {
      const path = '/v1/clinics/internal/create-platform';
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
      return res.data as { success: boolean; clinic: Record<string, unknown> };
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`createPlatformClinic failed: ${msg}`);
      throw new ServiceUnavailableException(
        'Could not create clinic. Please try again or contact support.',
      );
    }
  }

  async provisionFromActivation(payload: ProvisionClinicPayload): Promise<{ clinicId: string }> {
    try {
      const path = '/v1/clinics/internal/provision-from-activation';
      const res = await axios.post(`${this.baseUrl}${path}`, payload, {
        timeout: 10000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          payload,
        ),
      });
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
