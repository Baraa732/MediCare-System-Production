import { Injectable } from '@nestjs/common';
import { AuthHttpClient } from './auth-http.client';

@Injectable()
export class PlatformSecurityService {
  constructor(private readonly authHttpClient: AuthHttpClient) {}

  async getSummary(range = '1h') {
    const normalized =
      range === '6h' || range === '24h'
        ? range
        : range === '7d' || range === '30d'
          ? '24h'
          : '1h';
    const data = await this.authHttpClient.getSecuritySummary(normalized);
    if (!data) {
      return {
        available: false as const,
        timestamp: new Date().toISOString(),
        range: normalized,
        failedLogins: 0,
        suspicious: 0,
        rateLimitExceeded: 0,
        activeSessions: 0,
        loginEvents: 0,
        uniqueActors: 0,
        threatScore: 0,
        blockedIdentifiers: [],
        topIps: [],
        recentAudits: [],
        warning: 'Auth security summary unavailable',
      };
    }
    return data;
  }
}
