import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { CreateUserByAdminDto } from '../dto/auth.dto';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

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
  private readonly serviceName = 'auth-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  private headers(method: string, url: string, body?: unknown, requestId?: string): Record<string, string> {
    return createInternalAuthHeadersForUrl(
      this.serviceName,
      this.signingSecret,
      method,
      url,
      body,
      requestId ? { 'x-request-id': requestId } : undefined,
    );
  }

  private handleError(context: string, error: unknown): never {
    const msg = error instanceof AxiosError ? error.message : String(error);
    this.logger.error(`${context}: ${msg}`);
    throw new ServiceUnavailableException('User service temporarily unavailable. Please try again.');
  }

  async checkExists(phoneNumber: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/users/internal/exists?phoneNumber=${encodeURIComponent(phoneNumber)}`;
      const res = await axios.get(url, {
        timeout: 5000,
        headers: this.headers('GET', `/users/internal/exists?phoneNumber=${encodeURIComponent(phoneNumber)}`),
      });
      return res.data?.exists === true;
    } catch (error) {
      this.handleError('checkExists', error);
    }
  }

  async getUserById(userId: string): Promise<UserLookupResult> {
    try {
      const url = `${this.baseUrl}/users/internal/by-id/${userId}`;
      const res = await axios.get(url, {
        timeout: 5000,
        headers: this.headers('GET', `/users/internal/by-id/${userId}`),
      });
      return res.data;
    } catch (error) {
      this.handleError('getUserById', error);
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<UserLookupResult> {
    const encoded = encodeURIComponent(phoneNumber);
    try {
      const url = `${this.baseUrl}/users/internal/by-phone/${encoded}`;
      const res = await axios.get(url, {
        timeout: 5000,
        headers: this.headers('GET', `/users/internal/by-phone/${encoded}`),
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
    try {
      const url = `${this.baseUrl}/users/validate-login`;
      const body = { phoneNumber, password };
      const res = await axios.post(url, body, {
        timeout: 5000,
        headers: this.headers('POST', '/users/validate-login', body, requestId),
      });
      return res.data;
    } catch (error) {
      this.handleError('validateLogin', error);
    }
  }

  async createUser(body: Record<string, unknown>): Promise<{ success: boolean; userId?: string }> {
    try {
      const url = `${this.baseUrl}/users/internal/create`;
      const res = await axios.post(url, body, {
        timeout: 10000,
        headers: this.headers('POST', '/users/internal/create', body),
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
    try {
      const url = `${this.baseUrl}/users/internal/create-by-admin`;
      const res = await axios.post(url, body, {
        timeout: 10000,
        headers: this.headers('POST', '/users/internal/create-by-admin', body),
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
    try {
      const url = `${this.baseUrl}/users/internal/verify-phone`;
      const body = { phoneNumber };
      await axios.post(url, body, {
        timeout: 5000,
        headers: this.headers('POST', '/users/internal/verify-phone', body),
      });
    } catch (error) {
      this.handleError('verifyPhone', error);
    }
  }

  async completeStaffActivation(userId: string, newPassword: string): Promise<UserLookupResult> {
    try {
      const url = `${this.baseUrl}/users/internal/complete-staff-activation`;
      const body = { userId, newPassword };
      const res = await axios.post(url, body, {
        timeout: 10000,
        headers: this.headers('POST', '/users/internal/complete-staff-activation', body),
      });
      return res.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        throw error;
      }
      this.handleError('completeStaffActivation', error);
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/users/${userId}/reset-password-internal`;
      const body = { newPassword };
      await axios.post(url, body, {
        timeout: 5000,
        headers: this.headers('POST', `/users/${userId}/reset-password-internal`, body),
      });
    } catch (error) {
      this.handleError('resetPassword', error);
    }
  }
}
