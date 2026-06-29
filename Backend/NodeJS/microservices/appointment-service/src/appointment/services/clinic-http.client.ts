import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

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
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  private headers(): Record<string, string> {
    return { 'x-service-token': this.internalToken };
  }

  async verifyDoctorAtClinic(clinicId: string, doctorId: string): Promise<boolean> {
    if (!this.internalToken) return false;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/verify-staff`,
        { clinicId, userId: doctorId, staffRole: 'DOCTOR' },
        { timeout: 5000, headers: this.headers() },
      );
      return res.data?.valid === true;
    } catch (error) {
      this.logger.error(`verifyDoctorAtClinic failed: ${error}`);
      throw new ServiceUnavailableException('Clinic service temporarily unavailable');
    }
  }

  async checkClinicAccess(clinicId: string, userId: string): Promise<boolean> {
    if (!this.internalToken) return false;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/check-access`,
        { clinicId, userId },
        { timeout: 5000, headers: this.headers() },
      );
      return res.data?.allowed === true;
    } catch (error) {
      this.logger.error(`checkClinicAccess failed: ${error}`);
      throw new ServiceUnavailableException('Clinic service temporarily unavailable');
    }
  }

  async getClinicById(clinicId: string): Promise<ClinicSummary | null> {
    if (!this.internalToken) return null;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/get-by-id/${clinicId}`,
        {},
        { timeout: 5000, headers: this.headers() },
      );
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
