import { Injectable } from '@nestjs/common';
import { ApprovedBookingTool } from './approved-tools';

/** Converts raw tool payloads into LLM-safe summaries (no UUIDs or internal fields). */
@Injectable()
export class ToolResultSanitizerService {
  summarize(tool: ApprovedBookingTool, result: { success: boolean; data?: any; error?: string }): string {
    if (!result.success && result.error) {
      return `Tool ${tool} failed: ${result.error}`;
    }

    switch (tool) {
      case 'search_clinics': {
        const clinics = result.data?.clinics || [];
        if (!clinics.length) return 'No clinics found.';
        return clinics
          .slice(0, 5)
          .map(
            (c: any, i: number) =>
              `${i + 1}. ${c.name || 'Clinic'}${c.city ? ` (${c.city})` : ''}${c.address ? ` — ${c.address}` : ''}`,
          )
          .join('; ');
      }
      case 'list_doctors': {
        const doctors = result.data?.doctors || [];
        if (!doctors.length) return 'No doctors listed for this clinic.';
        return doctors
          .slice(0, 8)
          .map((d: any, i: number) => {
            const name =
              d.name ||
              [d.firstName, d.lastName].filter(Boolean).join(' ').trim() ||
              d.fullName ||
              'Doctor';
            return `${i + 1}. ${name}${d.specialization ? ` (${d.specialization})` : ''}`;
          })
          .join('; ');
      }
      case 'get_available_slots': {
        const slots = result.data?.slots || [];
        if (!slots.length) return 'No available slots for that date.';
        return slots
          .slice(0, 8)
          .map((s: any) => s.startTime || s.time || 'slot')
          .join(', ');
      }
      case 'book_appointment':
        return result.success ? 'Appointment booked successfully.' : 'Booking failed.';
      case 'modify_appointment':
        return result.success ? 'Appointment rescheduled successfully.' : 'Reschedule failed.';
      case 'get_upcoming_appointments': {
        const appts = result.data?.appointments || [];
        if (!appts.length) return 'No upcoming appointments.';
        return appts
          .slice(0, 5)
          .map(
            (a: any) =>
              `${a.clinicName || 'Clinic'} with ${a.doctorName || 'doctor'} at ${a.scheduledAt || 'TBD'} (${a.status || 'scheduled'})`,
          )
          .join('; ');
      }
      case 'cancel_appointment':
        return result.success ? 'Appointment cancelled.' : 'Cancellation failed.';
      default:
        return 'Operation completed.';
    }
  }
}
