import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface ClinicProfile {
  id: string;
  name: string;
}

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'notification-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  private headers(method: string, path: string, body?: unknown): Record<string, string> {
    return createInternalAuthHeadersForUrl(
      this.serviceName,
      this.signingSecret,
      method,
      path,
      body,
    );
  }

  async getClinicById(clinicId: string): Promise<ClinicProfile | null> {
    try {
      const path = `/v1/clinics/internal/get-by-id/${clinicId}`;
      const res = await axios.post(`${this.baseUrl}${path}`, {}, {
        timeout: 5000,
        headers: this.headers('POST', path, {}),
      });
      if (!res.data?.success || !res.data?.clinic) return null;
      return { id: res.data.clinic.id, name: res.data.clinic.name };
    } catch (error) {
      this.logger.error(`getClinicById failed: ${error}`);
      throw new ServiceUnavailableException('Clinic service temporarily unavailable');
    }
  }

  async listSecretaries(clinicId: string): Promise<Array<{ userId: string }>> {
    try {
      const path = '/v1/clinics/internal/list-staff';
      const body = { clinicId, staffRole: 'SECRETARY' };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 5000,
        headers: this.headers('POST', path, body),
      });
      if (!res.data?.success || !Array.isArray(res.data?.staff)) return [];
      return res.data.staff.map((s: { userId: string }) => ({ userId: s.userId }));
    } catch (error) {
      this.logger.error(`listSecretaries failed: ${error}`);
      return [];
    }
  }
}
