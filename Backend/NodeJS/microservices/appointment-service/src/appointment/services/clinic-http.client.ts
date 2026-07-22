import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface ClinicSummary {
  id: string;
  name: string;
  address?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  timezone?: string;
}

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'appointment-service';
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

  async verifyDoctorAtClinic(clinicId: string, doctorId: string): Promise<boolean> {
    try {
      const path = '/v1/clinics/internal/verify-staff';
      const body = { clinicId, userId: doctorId, staffRole: 'DOCTOR' };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 5000,
        headers: this.headers('POST', path, body),
      });
      return res.data?.valid === true;
    } catch (error) {
      this.logger.error(`verifyDoctorAtClinic failed: ${error}`);
      throw new ServiceUnavailableException('Clinic service temporarily unavailable');
    }
  }

  async checkClinicAccess(clinicId: string, userId: string, role?: string): Promise<boolean> {
    try {
      const path = '/v1/clinics/internal/check-access';
      const body = { clinicId, userId, role };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 5000,
        headers: this.headers('POST', path, body),
      });
      return res.data?.allowed === true;
    } catch (error) {
      this.logger.error(`checkClinicAccess failed: ${error}`);
      throw new ServiceUnavailableException('Clinic service temporarily unavailable');
    }
  }

  async getClinicById(clinicId: string): Promise<ClinicSummary | null> {
    try {
      const path = `/v1/clinics/internal/get-by-id/${clinicId}`;
      const res = await axios.post(`${this.baseUrl}${path}`, {}, {
        timeout: 5000,
        headers: this.headers('POST', path, {}),
      });
      return res.data?.clinic || null;
    } catch (error) {
      this.logger.error(`getClinicById failed: ${error}`);
      return null;
    }
  }

  async getClinicsByIds(clinicIds: string[]): Promise<ClinicSummary[]> {
    const results = await Promise.all(clinicIds.map((id) => this.getClinicById(id)));
    return results.filter(Boolean) as ClinicSummary[];
  }
}
