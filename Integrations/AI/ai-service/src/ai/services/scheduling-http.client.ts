import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { sanitizeAxiosError } from '../security/secure-logging';

export interface Slot {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

@Injectable()
export class SchedulingHttpClient {
  private readonly baseUrl = process.env.SCHEDULING_SERVICE_URL || 'http://scheduling-service:3008';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(SchedulingHttpClient.name);

  async getAvailableSlots(
    clinicId: string,
    doctorId: string,
    date: string,
    authHeader?: string,
  ): Promise<Slot[]> {
    if (!authHeader && !this.token) return [];
    try {
      const res = await axios.get(`${this.baseUrl}/v1/schedule/slots`, {
        params: { clinicId, doctorId, date },
        timeout: 8000,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(this.token ? { 'x-service-token': this.token } : {}),
        },
      });
      return res.data?.slots || res.data || [];
    } catch (error) {
      this.logger.warn('getAvailableSlots failed', sanitizeAxiosError(error));
      return [];
    }
  }

  async validateSlot(slotId: string): Promise<{ valid: boolean }> {
    if (!this.token) return { valid: false };
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/schedule/internal/validate-slot`,
        { slotId },
        {
          timeout: 8000,
          headers: { 'x-service-token': this.token },
        },
      );
      return { valid: res.data?.valid === true };
    } catch (error) {
      this.logger.warn('validateSlot failed', sanitizeAxiosError(error));
      return { valid: false };
    }
  }

  async validateSlotForTime(
    clinicId: string,
    doctorId: string,
    scheduledAt: string,
  ): Promise<{ valid: boolean }> {
    if (!scheduledAt) return { valid: false };
    const date = scheduledAt.slice(0, 10);
    const slots = await this.getAvailableSlots(clinicId, doctorId, date);
    return {
      valid: slots.some((slot) => {
        const slotIso = slot.startTime?.includes('T')
          ? slot.startTime
          : `${date}T${slot.startTime}:00.000Z`;
        return slotIso.startsWith(scheduledAt.slice(0, 16)) || slot.startTime === scheduledAt;
      }),
    };
  }
}
