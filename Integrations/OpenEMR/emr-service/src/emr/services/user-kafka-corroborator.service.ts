import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';
import { KafkaTenantCorroborator } from '../../kafka-security-shared/secured-kafka.consumer';

@Injectable()
export class UserKafkaCorroborator implements KafkaTenantCorroborator {
  private readonly logger = new Logger(UserKafkaCorroborator.name);
  private readonly userBaseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3002';
  private readonly appointmentBaseUrl =
    process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly serviceName = process.env.INTERNAL_AUTH_SERVICE_NAME || 'emr-service';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';

  async corroborateTenant(
    topic: string,
    tenantId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (topic === 'appointment.created' || topic === 'appointment.completed') {
      const patientId = payload.patientId;
      if (typeof patientId !== 'string') return false;
      return this.patientBelongsToClinic(patientId, tenantId);
    }

    if (topic !== 'user.created') return true;

    const userId = payload.userId;
    if (typeof userId !== 'string') return false;

    try {
      const path = `/users/internal/by-id/${userId}`;
      const url = `${this.userBaseUrl}${path}`;
      const headers = createInternalAuthHeadersForUrl(
        this.serviceName,
        this.signingSecret,
        'GET',
        path,
      );
      const response = await axios.get(url, {
        headers,
        timeout: 5000,
        validateStatus: () => true,
      });
      if (response.status !== 200 || !response.data?.user) return false;

      const user = response.data.user as Record<string, unknown>;
      const dbTenant =
        (user.tenantId as string | undefined) ?? (user.clinicId as string | undefined);
      if (dbTenant === tenantId) return true;

      if (user.role === 'PATIENT') {
        return this.patientBelongsToClinic(userId, tenantId);
      }

      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`User corroboration failed for ${userId}: ${message}`);
      return false;
    }
  }

  async fetchUserProfile(userId: string): Promise<{
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    gender?: string;
    birthDate?: string;
  } | null> {
    try {
      const path = `/users/internal/by-id/${userId}`;
      const url = `${this.userBaseUrl}${path}`;
      const headers = createInternalAuthHeadersForUrl(
        this.serviceName,
        this.signingSecret,
        'GET',
        path,
      );
      const response = await axios.get(url, {
        headers,
        timeout: 5000,
        validateStatus: () => true,
      });
      if (response.status !== 200 || !response.data?.user) return null;
      const user = response.data.user as Record<string, unknown>;
      return {
        phoneNumber: typeof user.phoneNumber === 'string' ? user.phoneNumber : undefined,
        firstName: typeof user.firstName === 'string' ? user.firstName : undefined,
        lastName: typeof user.lastName === 'string' ? user.lastName : undefined,
        email: typeof user.email === 'string' ? user.email : undefined,
        gender: typeof user.gender === 'string' ? user.gender : undefined,
        birthDate: typeof user.birthDate === 'string' ? user.birthDate : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`User profile fetch failed for ${userId}: ${message}`);
      return null;
    }
  }

  private async patientBelongsToClinic(patientId: string, clinicId: string): Promise<boolean> {
    const path = '/v1/appointments/internal/check-patient-clinic';
    const url = `${this.appointmentBaseUrl}${path}`;
    const body = { patientId, clinicId };
    const headers = createInternalAuthHeadersForUrl(
      this.serviceName,
      this.signingSecret,
      'POST',
      path,
      body,
    );
    const response = await axios.post(url, body, {
      headers,
      timeout: 5000,
      validateStatus: () => true,
    });
    return response.status === 200 && response.data?.allowed === true;
  }
}
