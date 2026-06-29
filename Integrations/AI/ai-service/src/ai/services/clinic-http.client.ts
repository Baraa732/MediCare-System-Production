import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { sanitizeAxiosError } from '../security/secure-logging';

export interface Clinic {
  id: string;
  name: string;
  address?: string;
  city?: string;
}

export interface Doctor {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  specialization?: string;
}

@Injectable()
export class ClinicHttpClient {
  private readonly baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(ClinicHttpClient.name);

  async searchClinics(query: string, authHeader?: string): Promise<Clinic[]> {
    if (!authHeader && !this.token) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/v1/clinics/search`, {
        params: { q: query },
        timeout: 8000,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(this.token ? { 'x-service-token': this.token } : {}),
        },
      });
      return res.data?.clinics || res.data || [];
    } catch (error) {
      this.logger.warn('searchClinics failed', sanitizeAxiosError(error));
      return [];
    }
  }

  async listDoctors(clinicId: string, authHeader?: string): Promise<Doctor[]> {
    if (!authHeader && !this.token) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/v1/clinics/${clinicId}/doctors`, {
        timeout: 8000,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(this.token ? { 'x-service-token': this.token } : {}),
        },
      });
      return res.data?.doctors || res.data || [];
    } catch (error) {
      this.logger.warn('listDoctors failed', sanitizeAxiosError(error));
      return [];
    }
  }

  async listClinics(authHeader?: string): Promise<Clinic[]> {
    if (!authHeader && !this.token) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/v1/clinics`, {
        timeout: 8000,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(this.token ? { 'x-service-token': this.token } : {}),
        },
      });
      return res.data?.clinics || res.data || [];
    } catch (error) {
      this.logger.warn('listClinics failed', sanitizeAxiosError(error));
      return [];
    }
  }
}
