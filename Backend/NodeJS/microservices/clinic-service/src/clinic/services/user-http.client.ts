import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';

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
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  private ensureToken(): void {
    if (!this.internalToken) {
      throw new Error('INTERNAL_SERVICE_TOKEN env var is not set');
    }
  }

  private hmac(subject: string, timestamp: string): string {
    return crypto.createHmac('sha256', this.internalToken).update(`${subject}:${timestamp}`).digest('hex');
  }

  private headers(subject: string): Record<string, string> {
    const timestamp = Date.now().toString();
    return {
      'x-service-token': this.internalToken,
      'x-internal-timestamp': timestamp,
      'x-internal-hmac': this.hmac(subject, timestamp),
    };
  }

  async getUserById(userId: string): Promise<UserProfile> {
    this.ensureToken();
    try {
      const res = await axios.get(`${this.baseUrl}/users/internal/by-id/${userId}`, {
        timeout: 5000,
        headers: this.headers(userId),
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
      profile?: Record<string, unknown>;
    }>
  > {
    if (!userIds.length) return [];
    this.ensureToken();
    try {
      const res = await axios.post(
        `${this.baseUrl}/users/internal/public-doctors`,
        { userIds },
        { timeout: 8000, headers: { 'x-service-token': this.internalToken } },
      );
      return res.data?.doctors || [];
    } catch (error) {
      this.logger.error(`getPublicDoctors failed: ${error}`);
      return [];
    }
  }

  async searchDoctorIds(filters: { q?: string; specialization?: string }): Promise<string[]> {
    this.ensureToken();
    try {
      const res = await axios.post(
        `${this.baseUrl}/users/internal/search-doctor-ids`,
        filters,
        { timeout: 5000, headers: { 'x-service-token': this.internalToken } },
      );
      return res.data?.doctorIds || [];
    } catch (error) {
      this.logger.error(`searchDoctorIds failed: ${error}`);
      return [];
    }
  }

  async findClinicAdminByClinicId(clinicId: string): Promise<UserProfile | null> {
    if (!clinicId) return null;
    this.ensureToken();
    try {
      const res = await axios.get(
        `${this.baseUrl}/users/internal/clinic-admin-by-clinic/${clinicId}`,
        { timeout: 5000, headers: { 'x-service-token': this.internalToken } },
      );
      return (res.data?.user as UserProfile) ?? null;
    } catch (error) {
      this.logger.error(`findClinicAdminByClinicId failed: ${error}`);
      return null;
    }
  }

  async updateClinicId(userId: string, clinicId: string): Promise<boolean> {
    this.ensureToken();
    try {
      await axios.patch(
        `${this.baseUrl}/users/internal/${userId}/clinic-id`,
        { clinicId },
        { timeout: 5000, headers: { 'x-service-token': this.internalToken } },
      );
      return true;
    } catch (error) {
      this.logger.error(`updateClinicId failed for ${userId}: ${error}`);
      return false;
    }
  }
}
