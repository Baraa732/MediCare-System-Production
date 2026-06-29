import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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
  private readonly internalToken: string;

  constructor() {
    this.baseUrl = process.env.SYSTEM_MANAGER_SERVICE_URL || 'http://system-manager-service:3003';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  }

  async lookupUsedActivationByPhone(phoneNumber: string): Promise<UsedActivationLookup> {
    if (!this.internalToken) {
      return { found: false };
    }

    try {
      const res = await axios.get(
        `${this.baseUrl}/v1/system-manager/activation-code/lookup-used-by-phone`,
        {
          params: { phoneNumber },
          timeout: 8000,
          headers: { 'x-service-token': this.internalToken },
        },
      );
      return res.data as UsedActivationLookup;
    } catch (error) {
      this.logger.error(`lookupUsedActivationByPhone failed: ${error}`);
      return { found: false };
    }
  }
}
