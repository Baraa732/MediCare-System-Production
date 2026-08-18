import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface AuthSecuritySummary {
  available: true;
  timestamp: string;
  range: string;
  failedLogins: number;
  suspicious: number;
  rateLimitExceeded: number;
  activeSessions: number;
  loginEvents: number;
  uniqueActors: number;
  threatScore: number;
  blockedIdentifiers: Array<{
    identifier: string;
    tier: string;
    failedAttempts: number;
    lockedUntil: string | null;
  }>;
  topIps: Array<{
    ip: string;
    count: number;
    lastSeen: string;
    actions: string[];
  }>;
  recentAudits: Array<{
    id: string;
    actor: string;
    action: string;
    target: string;
    result: string;
    ip: string | null;
    ago: string;
    createdAt: string;
  }>;
}

@Injectable()
export class AuthHttpClient {
  private readonly logger = new Logger(AuthHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'system-manager-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async getSecuritySummary(range = '1h'): Promise<AuthSecuritySummary | null> {
    const path = `/v1/auth/internal/security-summary?range=${encodeURIComponent(range)}`;
    try {
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 6000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'GET',
          path.split('?')[0],
          '',
        ),
      });
      return res.data as AuthSecuritySummary;
    } catch (error) {
      this.logger.warn(`security-summary unavailable: ${String(error)}`);
      return null;
    }
  }
}
