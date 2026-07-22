import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

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
  private readonly serviceName = 'system-manager-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async getPlatformStats(): Promise<UserPlatformStats | null> {
    try {
      const path = '/users/internal/stats';
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 5000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'GET',
          path,
        ),
      });
      return res.data as UserPlatformStats;
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`getPlatformStats failed: ${msg}`);
      return null;
    }
  }
}
