import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
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

  async getUserById(userId: string): Promise<UserProfile | null> {
    if (!this.internalToken) return null;
    try {
      const res = await axios.get(`${this.baseUrl}/users/internal/by-id/${userId}`, {
        timeout: 5000,
        headers: this.headers(userId),
      });
      if (!res.data?.success || !res.data?.user) return null;
      const user = res.data.user;
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
      };
    } catch (error) {
      this.logger.error(`getUserById failed: ${error}`);
      return null;
    }
  }
}
