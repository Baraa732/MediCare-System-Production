import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';

export interface PublicDoctorProfile {
  id: string;
  firstName: string;
  lastName: string;
  specialization?: string;
  profile?: Record<string, unknown>;
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

  private headers(subject: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const hmac = crypto
      .createHmac('sha256', this.internalToken)
      .update(`${subject}:${timestamp}`)
      .digest('hex');
    return {
      'x-service-token': this.internalToken,
      'x-internal-timestamp': timestamp,
      'x-internal-hmac': hmac,
    };
  }

  async getUserById(userId: string): Promise<{ id: string; role: string }> {
    if (!this.internalToken) throw new ServiceUnavailableException('User service unavailable');
    try {
      const res = await axios.get(`${this.baseUrl}/users/internal/by-id/${userId}`, {
        timeout: 5000,
        headers: this.headers(userId),
      });
      if (!res.data?.success || !res.data?.user) {
        throw new BadRequestException('User not found');
      }
      return { id: res.data.user.id, role: res.data.user.role };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`getUserById failed: ${error}`);
      throw new ServiceUnavailableException('User service temporarily unavailable');
    }
  }

  async getPublicDoctors(userIds: string[]): Promise<PublicDoctorProfile[]> {
    if (!this.internalToken || !userIds.length) return [];
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
}
