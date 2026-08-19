import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

export type BroadcastBatchResult = {
  success: boolean;
  recipients: number;
  inboxSaved: number;
  pushSuccess: number;
  pushFailed: number;
};

@Injectable()
export class NotificationHttpClient {
  private readonly logger = new Logger(NotificationHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'system-manager-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3009';
    this.signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async broadcastToPatients(
    title: string,
    body: string,
    userIds: string[],
  ): Promise<BroadcastBatchResult> {
    const path = '/v1/notifications/internal/broadcast-patients';
    const payload = { title, body, userIds };
    try {
      const res = await axios.post(`${this.baseUrl}${path}`, payload, {
        timeout: 60_000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          payload,
        ),
      });
      return {
        success: res.data?.success === true,
        recipients: Number(res.data?.recipients ?? 0),
        inboxSaved: Number(res.data?.inboxSaved ?? 0),
        pushSuccess: Number(res.data?.pushSuccess ?? 0),
        pushFailed: Number(res.data?.pushFailed ?? 0),
      };
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`broadcastToPatients failed: ${msg}`);
      throw error;
    }
  }

  async broadcastToDoctors(
    title: string,
    body: string,
    userIds: string[],
  ): Promise<BroadcastBatchResult> {
    const path = '/v1/notifications/internal/broadcast-doctors';
    const payload = { title, body, userIds };
    try {
      const res = await axios.post(`${this.baseUrl}${path}`, payload, {
        timeout: 60_000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          payload,
        ),
      });
      return {
        success: res.data?.success === true,
        recipients: Number(res.data?.recipients ?? 0),
        inboxSaved: Number(res.data?.inboxSaved ?? 0),
        pushSuccess: Number(res.data?.pushSuccess ?? 0),
        pushFailed: Number(res.data?.pushFailed ?? 0),
      };
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`broadcastToDoctors failed: ${msg}`);
      throw error;
    }
  }

  async notifySystemManagers(payload: {
    userIds: string[];
    title: string;
    body: string;
    severity?: string;
    kind?: string;
    deepLink?: string;
    dedupeKey?: string;
    clinicId?: string;
  }): Promise<{ success: boolean; delivered: number; skipped: number }> {
    const path = '/v1/notifications/internal/system-managers';
    try {
      const res = await axios.post(`${this.baseUrl}${path}`, payload, {
        timeout: 20_000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          payload,
        ),
      });
      return {
        success: res.data?.success === true,
        delivered: Number(res.data?.delivered ?? 0),
        skipped: Number(res.data?.skipped ?? 0),
      };
    } catch (error) {
      const msg = error instanceof AxiosError ? error.message : String(error);
      this.logger.error(`notifySystemManagers failed: ${msg}`);
      return { success: false, delivered: 0, skipped: 0 };
    }
  }
}
