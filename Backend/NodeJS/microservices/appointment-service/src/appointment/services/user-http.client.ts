import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

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
  private readonly serviceName = 'appointment-service';
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

  async getUserById(userId: string): Promise<{
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    birthDate?: string;
    phoneNumber?: string;
  }> {
    try {
      const path = `/users/internal/by-id/${userId}`;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 5000,
        headers: this.headers('GET', path),
      });
      if (!res.data?.success || !res.data?.user) {
        throw new BadRequestException('User not found');
      }
      const user = res.data.user;
      return {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        birthDate: user.birthDate,
        phoneNumber: user.phoneNumber,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`getUserById failed: ${error}`);
      throw new ServiceUnavailableException('User service temporarily unavailable');
    }
  }

  async getPublicPatients(userIds: string[]): Promise<
    Array<{
      id: string;
      firstName?: string;
      lastName?: string;
      gender?: string;
      birthDate?: string;
      phoneNumber?: string;
    }>
  > {
    if (!userIds.length) return [];
    const unique = [...new Set(userIds)];
    const results = await Promise.all(
      unique.map(async (id) => {
        try {
          return await this.getUserById(id);
        } catch {
          return { id };
        }
      }),
    );
    return results;
  }

  async getPublicDoctors(userIds: string[]): Promise<PublicDoctorProfile[]> {
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
}
