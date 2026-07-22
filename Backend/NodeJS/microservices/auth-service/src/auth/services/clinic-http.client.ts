import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

type StaffRoleHint = 'DOCTOR' | 'SECRETARY' | 'CLINIC_ADMIN';

export interface StaffAssignmentHints {
  clinicId?: string;
  staffRole?: StaffRoleHint;
}

@Injectable()
export class ClinicHttpClient {
  private readonly logger = new Logger(ClinicHttpClient.name);
  private readonly baseUrl: string;
  private readonly serviceName = 'auth-service';
  private readonly signingSecret: string;

  constructor() {
    this.baseUrl = process.env.CLINIC_SERVICE_URL || 'http://clinic-service:3006';
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

  async ensureStaffAssignment(
    userId: string,
    assignedBy: string,
    hints?: StaffAssignmentHints,
  ): Promise<{ assigned: boolean; clinicId?: string }> {
    try {
      const path = '/v1/clinics/internal/ensure-staff-assignment';
      const body = { userId, assignedBy, ...hints };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 8000,
        headers: this.headers('POST', path, body),
      });
      return {
        assigned: res.data?.assigned === true,
        clinicId: res.data?.clinicId,
      };
    } catch (error) {
      this.logger.error(`ensureStaffAssignment failed for ${userId}: ${error}`);
      return { assigned: false };
    }
  }

  async assignStaffInternal(payload: {
    clinicId: string;
    userId: string;
    staffRole: StaffRoleHint;
    assignedBy: string;
  }): Promise<{ assigned: boolean; clinicId?: string; reason?: string }> {
    try {
      const path = '/v1/clinics/internal/assign-staff';
      const res = await axios.post(`${this.baseUrl}${path}`, payload, {
        timeout: 8000,
        headers: this.headers('POST', path, payload),
      });
      return {
        assigned: res.data?.assigned === true,
        clinicId: res.data?.clinicId,
        reason: res.data?.reason,
      };
    } catch (error) {
      this.logger.error(
        `assignStaffInternal failed for ${payload.userId} @ ${payload.clinicId}: ${error}`,
      );
      return { assigned: false, reason: 'REQUEST_FAILED' };
    }
  }

  async resolveStaffClinic(
    userId: string,
  ): Promise<{ clinicId?: string; source?: string }> {
    try {
      const path = '/v1/clinics/internal/resolve-staff-clinic';
      const body = { userId };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 8000,
        headers: this.headers('POST', path, body),
      });
      return {
        clinicId: res.data?.clinicId,
        source: res.data?.source,
      };
    } catch (error) {
      this.logger.error(`resolveStaffClinic failed for ${userId}: ${error}`);
      return {};
    }
  }

  async activatePendingMemberships(userId: string): Promise<{ activated: number }> {
    try {
      const path = '/v1/clinics/internal/activate-pending-memberships';
      const body = { userId };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 8000,
        headers: this.headers('POST', path, body),
      });
      return { activated: res.data?.activated ?? 0 };
    } catch (error) {
      this.logger.error(`activatePendingMemberships failed for ${userId}: ${error}`);
      return { activated: 0 };
    }
  }

  async clinicExists(clinicId: string): Promise<boolean> {
    try {
      const path = `/v1/clinics/internal/get-by-id/${clinicId}`;
      const res = await axios.post(`${this.baseUrl}${path}`, {}, {
        timeout: 5000,
        headers: this.headers('POST', path, {}),
      });
      return res.data?.success === true;
    } catch {
      return false;
    }
  }
}
