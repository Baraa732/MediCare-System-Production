import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { getCorrelationId, sanitizeAxiosError } from '../security/secure-logging';

export interface Appointment {
  appointmentId: string;
  clinicName?: string;
  doctorName?: string;
  scheduledAt: string;
  status: string;
}

@Injectable()
export class AppointmentHttpClient {
  private readonly baseUrl = process.env.APPOINTMENT_SERVICE_URL || 'http://appointment-service:3007';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(AppointmentHttpClient.name);

  private patientHeaders(patientId: string, authHeader?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;
    if (this.token) headers['x-service-token'] = this.token;
    headers['x-patient-id'] = patientId;
    return headers;
  }

  private mutationHeaders(authHeader?: string): Record<string, string> {
    if (!authHeader) return {};
    return { Authorization: authHeader };
  }

  async getPatientUpcomingSummary(patientId: string, limit = 3): Promise<Appointment[]> {
    if (!this.token) return [];
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/appointments/internal/patient-upcoming-summary`,
        { patientId, limit },
        { timeout: 8000, headers: { 'x-service-token': this.token } },
      );
      return res.data?.summary || [];
    } catch (error) {
      this.logger.warn('getPatientUpcomingSummary failed', sanitizeAxiosError(error));
      return [];
    }
  }

  async verifyOwnership(patientId: string, appointmentId: string): Promise<boolean> {
    if (!this.token || !patientId || !appointmentId) return false;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/appointments/internal/verify-ownership`,
        { appointmentId },
        {
          timeout: 8000,
          headers: this.patientHeaders(patientId),
        },
      );
      return res.data?.owned === true;
    } catch (error) {
      this.logger.warn('verifyOwnership failed', {
        ...sanitizeAxiosError(error),
        correlationId: getCorrelationId(),
      });
      return false;
    }
  }

  async isAppointmentOwnedByPatient(appointmentId: string, patientId: string): Promise<boolean> {
    return this.verifyOwnership(patientId, appointmentId);
  }

  async bookAppointment(
    patientId: string,
    clinicId: string,
    doctorId: string,
    scheduledAt: string,
    authHeader?: string,
  ): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    if (!authHeader) return { success: false, error: 'Missing patient authorization' };
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/appointments`,
        { clinicId, doctorId, scheduledAt },
        { timeout: 8000, headers: this.mutationHeaders(authHeader) },
      );
      const appointment = res.data?.appointment;
      return {
        success: true,
        appointmentId: appointment?.id || res.data?.appointmentId,
      };
    } catch (error: any) {
      if (error.response?.status === 409) {
        return { success: false, error: 'CONFLICT' };
      }
      this.logger.warn('bookAppointment failed', sanitizeAxiosError(error));
      return { success: false, error: 'BOOKING_FAILED' };
    }
  }

  async updateAppointment(
    appointmentId: string,
    scheduledAt: string,
    authHeader?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!authHeader) return { success: false, error: 'Missing patient authorization' };
    try {
      await axios.put(
        `${this.baseUrl}/v1/appointments/${appointmentId}`,
        { scheduledAt },
        { timeout: 8000, headers: this.mutationHeaders(authHeader) },
      );
      return { success: true };
    } catch (error: any) {
      if (error.response?.status === 409) {
        return { success: false, error: 'CONFLICT' };
      }
      this.logger.warn('updateAppointment failed', sanitizeAxiosError(error));
      return { success: false, error: 'UPDATE_FAILED' };
    }
  }

  async cancelAppointment(
    appointmentId: string,
    reason: string | undefined,
    authHeader?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!authHeader) return { success: false, error: 'Missing patient authorization' };
    try {
      await axios.patch(
        `${this.baseUrl}/v1/appointments/${appointmentId}/status`,
        { status: 'CANCELLED', cancellationReason: reason },
        { timeout: 8000, headers: this.mutationHeaders(authHeader) },
      );
      return { success: true };
    } catch (error) {
      this.logger.warn('cancelAppointment failed', sanitizeAxiosError(error));
      return { success: false, error: 'CANCEL_FAILED' };
    }
  }
}
