import { Injectable } from '@nestjs/common';
import { AppointmentHttpClient } from './appointment-http.client-v2';

@Injectable()
export class PatientContextService {
  constructor(private readonly appointmentHttp: AppointmentHttpClient) {}

  async buildContext(userId: string, manualContext?: string): Promise<string> {
    const parts: string[] = [];
    if (manualContext?.trim()) {
      parts.push(manualContext.trim());
    }

    const upcoming = await this.appointmentHttp.getPatientUpcomingSummary(userId, 5);
    if (upcoming.length > 0) {
      const lines = upcoming.map((a) => {
        const when = new Date(a.scheduledAt).toLocaleString('en-GB', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${when} with ${a.doctorName || 'doctor'} at ${a.clinicName || 'clinic'} (${a.status})`;
      });
      parts.push(`Patient upcoming appointments:\n${lines.join('\n')}`);
    }

    return parts.join('\n\n');
  }
}
