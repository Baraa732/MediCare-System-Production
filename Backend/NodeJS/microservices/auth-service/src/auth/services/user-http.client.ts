import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { CreateUserByAdminDto } from '../dto/auth.dto';

export interface AuthUserProfile {
  id: string;
  phoneNumber: string;
  role: string;
  tenantId?: string;
  clinicId?: string;
  isDashboardActivated?: boolean;
  status?: string;
  mustChangePassword?: boolean;
}

export type UserLookupResult = { success: boolean; user?: AuthUserProfile };

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

  private headers(subject: string, requestId?: string): Record<string, string> {
    const timestamp = Date.now().toString();
    return {
      'x-service-token': this.internalToken,
      'x-internal-timestamp': timestamp,
      'x-internal-hmac': this.hmac(subject, timestamp),
      ...(requestId ? { 'x-request-id': requestId } : {}),
    };
  }

  private handleError(context: string, error: unknown): never {
    const msg = error instanceof AxiosError ? error.message : String(error);
    this.logger.error(`${context}: ${msg}`);
    throw new ServiceUnavailableException('User service temporarily unavailable. Please try again.');
  }

  async checkExists(phoneNumber: string): Promise<boolean> {
    this.ensureToken();
    try {
      const subject = phoneNumber;
      const res = await axios.get(`${this.baseUrl}/users/internal/exists`, {
        params: { phoneNumber },
        timeout: 5000,
        headers: this.headers(subject),
      });
      return res.data?.exists === true;
    } catch (error) {
      this.handleError('checkExists', error);
    }
  }

  async getUserById(userId: string): Promise<UserLookupResult> {
    this.ensureToken();
    try {
      const res = await axios.get(`${this.baseUrl}/users/internal/by-id/${userId}`, {
        timeout: 5000,
        headers: this.headers(userId),
      });
      return res.data;
    } catch (error) {
      this.handleError('getUserById', error);
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<UserLookupResult> {
    this.ensureToken();
    const encoded = encodeURIComponent(phoneNumber);
    try {
      const res = await axios.get(`${this.baseUrl}/users/internal/by-phone/${encoded}`, {
        timeout: 5000,
        headers: this.headers(phoneNumber),
      });
      return res.data;
    } catch (error) {
      this.handleError('getUserByPhone', error);
    }
  }

  async validateLogin(
    phoneNumber: string,
    password: string,
    deviceInfo?: Record<string, unknown>,
    requestId?: string,
  ): Promise<UserLookupResult> {
    this.ensureToken();
    try {
      const res = await axios.post(
        `${this.baseUrl}/users/validate-login`,
        { phoneNumber, password, deviceInfo },
        { timeout: 5000, headers: this.headers(phoneNumber, requestId) },
      );
      return res.data;
    } catch (error) {
      this.handleError('validateLogin', error);
    }
  }

  async createUser(body: Record<string, unknown>): Promise<{ success: boolean; userId?: string }> {
    this.ensureToken();
    const phone = String(body.phoneNumber);
    try {
      const res = await axios.post(`${this.baseUrl}/users/internal/create`, body, {
        timeout: 10000,
        headers: this.headers(phone),
      });
      return res.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        throw error;
      }
      this.handleError('createUser', error);
    }
  }

  async createUserByAdmin(body: CreateUserByAdminDto): Promise<{
    success: boolean;
    message?: string;
    userId?: string;
    temporaryPassword?: string;
    activationExpiresAt?: string;
    status?: string;
  }> {
    this.ensureToken();
    const phone = String(body.phoneNumber);
    try {
      const res = await axios.post(`${this.baseUrl}/users/internal/create-by-admin`, body, {
        timeout: 10000,
        headers: this.headers(phone),
      });
      return res.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        throw error;
      }
      this.handleError('createUserByAdmin', error);
    }
  }

  async verifyPhone(phoneNumber: string): Promise<void> {
    this.ensureToken();
    try {
      await axios.post(
        `${this.baseUrl}/users/internal/verify-phone`,
        { phoneNumber },
        { timeout: 5000, headers: this.headers(phoneNumber) },
      );
    } catch (error) {
      this.handleError('verifyPhone', error);
    }
  }

  async completeStaffActivation(userId: string, newPassword: string): Promise<UserLookupResult> {
    this.ensureToken();
    try {
      const res = await axios.post(
        `${this.baseUrl}/users/internal/complete-staff-activation`,
        { userId, newPassword },
        { timeout: 10000, headers: this.headers(userId) },
      );
      return res.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        throw error;
      }
      this.handleError('completeStaffActivation', error);
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    this.ensureToken();
    try {
      await axios.post(
        `${this.baseUrl}/users/${userId}/reset-password-internal`,
        { newPassword },
        { timeout: 5000,
          headers: { 'x-service-token': this.internalToken },
        },
      );
    } catch (error) {
      this.handleError('resetPassword', error);
    }
  }
}
