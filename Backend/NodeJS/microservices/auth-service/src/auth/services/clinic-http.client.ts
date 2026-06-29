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

  async ensureStaffAssignment(
    userId: string,
    assignedBy: string,
  ): Promise<{ assigned: boolean; clinicId?: string }> {
    if (!this.internalToken) {
      this.logger.warn('INTERNAL_SERVICE_TOKEN not set — skipping staff assignment');
      return { assigned: false };
    }

    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/ensure-staff-assignment`,
        { userId, assignedBy },
        { timeout: 8000, headers: this.headers() },
      );
      return {
        assigned: res.data?.assigned === true,
        clinicId: res.data?.clinicId,
      };
    } catch (error) {
      this.logger.error(`ensureStaffAssignment failed for ${userId}: ${error}`);
      return { assigned: false };
    }
  }

  async resolveStaffClinic(
    userId: string,
  ): Promise<{ clinicId?: string; source?: string }> {
    if (!this.internalToken) {
      this.logger.warn('INTERNAL_SERVICE_TOKEN not set — cannot resolve staff clinic');
      return {};
    }

    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/resolve-staff-clinic`,
        { userId },
        { timeout: 8000, headers: this.headers() },
      );
      return {
        clinicId: res.data?.clinicId,
        source: res.data?.source,
      };
    } catch (error) {
      this.logger.error(`resolveStaffClinic failed for ${userId}: ${error}`);
      return {};
    }
  }

  async clinicExists(clinicId: string): Promise<boolean> {
    if (!this.internalToken) {
      return false;
    }

    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/clinics/internal/get-by-id/${clinicId}`,
        {},
        { timeout: 5000, headers: this.headers() },
      );
      return res.data?.success === true;
    } catch {
      return false;
    }
  }
}
