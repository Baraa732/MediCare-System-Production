import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
}

@Injectable()
export class UserHttpClient {
  private readonly logger = new Logger(UserHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'notification-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const path = `/users/internal/by-id/${userId}`;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 5000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'GET',
          path,
        ),
      });
      if (!res.data?.success || !res.data?.user) return null;
      const user = res.data.user;
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(`getUserById failed: ${error}`);
      throw new ServiceUnavailableException('User service temporarily unavailable');
    }
  }
}
