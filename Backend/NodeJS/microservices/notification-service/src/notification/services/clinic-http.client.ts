import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

export interface ClinicProfile {
  id: string;
  name: string;
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

  private headers(): Record<string, string> {
    return { 'x-service-token': this.internalToken };
  }

  async getClinicById(clinicId: string): Promise<ClinicProfile | null> {
    if (!this.internalToken) return null;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/get-by-id/${clinicId}`,
        {},
        { timeout: 5000, headers: this.headers() },
      );
      if (!res.data?.success || !res.data?.clinic) return null;
      return { id: res.data.clinic.id, name: res.data.clinic.name };
    } catch (error) {
      this.logger.error(`getClinicById failed: ${error}`);
      throw new ServiceUnavailableException('Clinic service temporarily unavailable');
    }
  }

  async listSecretaries(clinicId: string): Promise<Array<{ userId: string }>> {
    if (!this.internalToken) return [];
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/list-staff`,
        { clinicId, staffRole: 'SECRETARY' },
        { timeout: 5000, headers: this.headers() },
      );
      if (!res.data?.success || !Array.isArray(res.data?.staff)) return [];
      return res.data.staff.map((s: { userId: string }) => ({ userId: s.userId }));
    } catch (error) {
      this.logger.error(`listSecretaries failed: ${error}`);
      return [];
    }
  }
}
