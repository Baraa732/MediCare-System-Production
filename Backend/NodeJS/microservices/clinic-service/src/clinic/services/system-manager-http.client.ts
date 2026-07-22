import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export interface UsedActivationLookup {
  found: boolean;
  activationCodeId?: string;
  adminPhoneNumber?: string;
  clinicLocation?: string;
  adminFullName?: string;
  generatedBy?: string;
}

@Injectable()
export class SystemManagerHttpClient {
  private readonly logger = new Logger(SystemManagerHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'clinic-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.SYSTEM_MANAGER_SERVICE_URL || 'http://system-manager-service:3003';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async lookupUsedActivationByPhone(phoneNumber: string): Promise<UsedActivationLookup> {
    try {
      const path = `/v1/system-manager/activation-code/lookup-used-by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`;
      const res = await axios.get(`${this.baseUrl}${path}`, {
        timeout: 8000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'GET',
          `/v1/system-manager/activation-code/lookup-used-by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        ),
      });
      return res.data as UsedActivationLookup;
    } catch (error) {
      this.logger.error(`lookupUsedActivationByPhone failed: ${error}`);
      return { found: false };
    }
  }
}
