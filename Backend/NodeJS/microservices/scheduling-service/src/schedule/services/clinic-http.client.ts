import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ClinicHttpClient {
  private readonly baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(ClinicHttpClient.name);

  async verifyDoctorAtClinic(clinicId: string, doctorId: string): Promise<boolean> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/verify-staff`,
        { clinicId, userId: doctorId, staffRole: 'DOCTOR' },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.valid === true;
    } catch (e) {
      this.logger.error(`verifyDoctorAtClinic: ${e}`);
      throw new ServiceUnavailableException('Clinic service unavailable');
    }
  }

  async checkClinicAccess(clinicId: string, userId: string): Promise<boolean> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/check-access`,
        { clinicId, userId },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.allowed === true;
    } catch (e) {
      this.logger.error(`checkClinicAccess: ${e}`);
      throw new ServiceUnavailableException('Clinic service unavailable');
    }
  }

  async getClinicTimezone(clinicId: string): Promise<string> {
    if (!this.token) return 'Asia/Damascus';
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/get-by-id/${clinicId}`,
        {},
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.clinic?.timezone || 'Asia/Damascus';
    } catch {
      return 'Asia/Damascus';
    }
  }
}
