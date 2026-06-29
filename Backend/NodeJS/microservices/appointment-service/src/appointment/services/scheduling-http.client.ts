import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class SchedulingHttpClient {
  private readonly baseUrl = process.env.SCHEDULING_SERVICE_URL || 'http://scheduling-service:3008';
  private readonly token = process.env.INTERNAL_SERVICE_TOKEN || '';
  private readonly logger = new Logger(SchedulingHttpClient.name);

  async validateSlot(
    clinicId: string,
    doctorId: string,
    scheduledAt: string,
    durationMinutes: number,
  ): Promise<void> {
    if (!this.token) return;
    try {
      const res = await axios.post(
        `${this.baseUrl}/v1/schedule/internal/validate-slot`,
        { clinicId, doctorId, scheduledAt, durationMinutes },
        { timeout: 5000, headers: { 'x-service-token': this.token } },
      );
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
