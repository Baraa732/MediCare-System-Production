import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { createInternalAuthHeadersForUrl } from '../../internal-auth-shared/internal-http.signer';

@Injectable()
export class SchedulingHttpClient {
  private readonly baseUrl = process.env.SCHEDULING_SERVICE_URL || 'http://scheduling-service:3008';
  private readonly serviceName = 'appointment-service';
  private readonly signingSecret = process.env.INTERNAL_AUTH_SECRET || '';
  private readonly logger = new Logger(SchedulingHttpClient.name);

  constructor() {
    if (!this.signingSecret) {
      throw new Error('INTERNAL_AUTH_SECRET env var is not set');
    }
  }

  async validateSlot(
    clinicId: string,
    doctorId: string,
    scheduledAt: string,
    durationMinutes: number,
    strictHours = false,
    excludeAppointmentId?: string,
    excludeAppointmentIds?: string[],
  ): Promise<void> {
    try {
      const path = '/v1/schedule/internal/validate-slot';
      const body = {
        clinicId,
        doctorId,
        scheduledAt,
        durationMinutes,
        strictHours,
        excludeAppointmentId,
        excludeAppointmentIds,
      };
      const res = await axios.post(`${this.baseUrl}${path}`, body, {
        timeout: 5000,
        headers: createInternalAuthHeadersForUrl(
          this.serviceName,
          this.signingSecret,
          'POST',
          path,
          body,
        ),
      });
      if (!res.data?.valid) {
        throw new BadRequestException(
          res.data?.reason === 'SLOT_NOT_AVAILABLE'
            ? 'Selected time slot is not available'
            : 'Doctor schedule is not available at this clinic',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`validateSlot failed: ${error}`);
      throw new ServiceUnavailableException('Scheduling service temporarily unavailable');
    }
  }
}
