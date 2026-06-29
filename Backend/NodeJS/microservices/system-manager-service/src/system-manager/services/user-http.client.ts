import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export interface UserPlatformStats {
  total: number;
  active: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
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

  async getPlatformStats(): Promise<UserPlatformStats | null> {
    if (!this.internalToken) {
      this.logger.warn('INTERNAL_SERVICE_TOKEN is not set — skipping user stats');
      return null;
    }

    try {
      const res = await axios.get(`${this.baseUrl}/users/internal/stats`, {
        timeout: 5000,
        headers: { 'x-service-token': this.internalToken },
      });
      return res.data as UserPlatformStats;
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`getPlatformStats failed: ${msg}`);
      return null;
    }
  }
}
