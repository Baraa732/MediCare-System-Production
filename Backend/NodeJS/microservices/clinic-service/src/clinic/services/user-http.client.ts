import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface UserProfile {
  id: string;
  role: string;
  tenantId?: string | null;
  clinicId?: string | null;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
}

@Injectable()
export class UserHttpClient {
  private readonly logger = new Logger(UserHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'clinic-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
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

  async getUserById(userId: string): Promise<UserProfile> {
    try {
      const path = `/users/internal/by-id/${userId}`;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 5000,
        headers: this.headers('GET', path),
      });
      if (!res.data?.success || !res.data?.user) {
        throw new BadRequestException('User not found');
      }
      return res.data.user as UserProfile;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw new BadRequestException('User not found');
      }
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`getUserById failed: ${msg}`);
      throw new ServiceUnavailableException('User service temporarily unavailable');
    }
  }

  async getPublicDoctors(userIds: string[]): Promise<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      specialization?: string;
      yearsOfExperience?: number;
      status?: string;
      profile?: Record<string, unknown>;
    }>
  > {
    if (!userIds.length) return [];
    try {
      const path = '/users/internal/public-doctors';
      const body = { userIds };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 8000,
        headers: this.headers('POST', path, body),
      });
      return res.data?.doctors || [];
    } catch (error) {
      this.logger.error(`getPublicDoctors failed: ${error}`);
      return [];
    }
  }

  async getClinicStaffProfiles(userIds: string[]): Promise<
    Array<{
      id: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      phoneNumber?: string;
      email?: string;
      username?: string;
      role?: string;
      status?: string;
      specialization?: string;
      licenseNumber?: string;
      gender?: string;
      yearsOfExperience?: number;
      governorate?: string;
      state?: string;
      streetInfo?: string;
      birthDate?: string;
      nationalId?: string;
      maritalStatus?: string;
      languages?: string[];
      department?: string;
      shift?: string;
      createdAt?: string;
      updatedAt?: string;
    }>
  > {
    if (!userIds.length) return [];
    try {
      const path = '/users/internal/clinic-staff-profiles';
      const body = { userIds };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 8000,
        headers: this.headers('POST', path, body),
      });
      return res.data?.staff || [];
    } catch (error) {
      this.logger.error(`getClinicStaffProfiles failed: ${error}`);
      return [];
    }
  }

  async searchDoctorIds(filters: { q?: string; specialization?: string }): Promise<string[]> {
    try {
      const path = '/users/internal/search-doctor-ids';
      const res = await axios.post(`${this.baseUrl}${path}`, filters, {
        timeout: 5000,
        headers: this.headers('POST', path, filters),
      });
      return res.data?.doctorIds || [];
    } catch (error) {
      this.logger.error(`searchDoctorIds failed: ${error}`);
      return [];
    }
  }

  async findClinicAdminByClinicId(clinicId: string): Promise<UserProfile | null> {
    if (!clinicId) return null;
    try {
      const path = `/users/internal/clinic-admin-by-clinic/${clinicId}`;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 5000,
        headers: this.headers('GET', path),
      });
      return (res.data?.user as UserProfile) ?? null;
    } catch (error) {
      this.logger.error(`findClinicAdminByClinicId failed: ${error}`);
      return null;
    }
  }

  async updateClinicId(userId: string, clinicId: string): Promise<boolean> {
    try {
      const path = `/users/internal/${userId}/clinic-id`;
      const body = { clinicId };
      await axios.patch(`${this.baseUrl}${path}`, body, {
        timeout: 5000,
        headers: this.headers('PATCH', path, body),
      });
      return true;
    } catch (error) {
      this.logger.error(`updateClinicId failed for ${userId}: ${error}`);
      return false;
    }
  }
}
