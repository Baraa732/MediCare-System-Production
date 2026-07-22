import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

@Injectable()
export class ClinicHttpClient {
  private readonly baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
  private readonly serviceName = 'scheduling-service';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
  private readonly logger = new Logger(ClinicHttpClient.name);

  constructor() {
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
    } catch (e) {
      this.logger.error(`verifyDoctorAtClinic: ${e}`);
      throw new ServiceUnavailableException('Clinic service unavailable');
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
    } catch (e) {
      this.logger.error(`checkClinicAccess: ${e}`);
      throw new ServiceUnavailableException('Clinic service unavailable');
    }
  }

  async getClinicTimezone(clinicId: string): Promise<string> {
    try {
      const path = `/v1/clinics/internal/get-by-id/${clinicId}`;
      const res = await axios.post(`${this.baseUrl}${path}`, {}, {
        timeout: 5000,
        headers: this.headers('POST', path, {}),
      });
      return res.data?.clinic?.timezone || 'Asia/Damascus';
    } catch {
      return 'Asia/Damascus';
    }
  }
}
