import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { sanitizeAxiosError } from '../security/secure-logging';

export interface PublicDoctorProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  specialization?: string;
  profile?: Record<string, unknown>;
}

@Injectable()
export class UserHttpClient {
  private readonly baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(UserHttpClient.name);

  async searchDoctorIds(query: string): Promise<string[]> {
    if (!this.token || !query.trim()) return [];
    try {
      const res = await axios.post(
        `${this.baseUrl}/users/internal/search-doctor-ids`,
        { q: query.trim() },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.doctorIds || [];
    } catch (error) {
      this.logger.warn('searchDoctorIds failed', sanitizeAxiosError(error));
      return [];
    }
  }

  async getPublicDoctors(userIds: string[]): Promise<PublicDoctorProfile[]> {
    if (!this.token || userIds.length === 0) return [];
    try {
      const res = await axios.post(
        `${this.baseUrl}/users/internal/public-doctors`,
        { userIds: [...new Set(userIds)] },
        { timeout: 8000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.doctors || [];
    } catch (error) {
      this.logger.warn('getPublicDoctors failed', sanitizeAxiosError(error));
      return [];
    }
  }
}
