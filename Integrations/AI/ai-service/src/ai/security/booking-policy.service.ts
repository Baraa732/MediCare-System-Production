import { Injectable, Logger } from '@nestjs/common';
import { AppointmentHttpClient } from '../services/appointment-http.client-v2';
import {
  APPROVED_BOOKING_TOOLS,
  ApprovedBookingTool,
  PolicyContext,
  PolicyDecision,
  ToolCallRequest,
} from './booking-tool.types';
import { InjectionDetectorService } from './injection-detector.service';
import { getCorrelationId } from './secure-logging';

/** Legacy session shape retained for BOOKING_USE_SAFE_REFS=false policy tests. */
export interface LegacyBookingSession {
  clinicId?: string;
  clinicName?: string;
  doctorId?: string;
  doctorName?: string;
  doctorCandidates?: Array<{ id: string; name?: string }>;
  date?: string;
  slotId?: string;
  slotTime?: string;
  appointmentId?: string;
  step?: string;
  candidates?: Array<{ id: string; name?: string; city?: string; address?: string }>;
}

const FORBIDDEN_PARAM_KEYS = new Set([
  'patientId',
  'userId',
  'authorization',
  'token',
  'accessToken',
  'refreshToken',
]);

@Injectable()
export class BookingPolicyService {
  private readonly logger = new Logger(BookingPolicyService.name);

  constructor(
    private injectionDetector: InjectionDetectorService,
    private appointmentClient: AppointmentHttpClient,
  ) {}

  validateUserMessage(message: string): PolicyDecision {
    const assessment = this.injectionDetector.assessUserMessage(message);
    if (assessment.blocked) {
      this.logger.warn({
        correlationId: getCorrelationId(),
        reason: assessment.reason || 'injection_detected',
      });
      return { allowed: false, reason: 'Invalid request format.' };
    }
    return { allowed: true };
  }

  async validateToolCall(
    request: ToolCallRequest,
    ctx: PolicyContext,
    session: LegacyBookingSession,
  ): Promise<PolicyDecision> {
    const normalized = this.normalizeToolName(request.tool);
    if (!APPROVED_BOOKING_TOOLS.includes(normalized as ApprovedBookingTool)) {
      return { allowed: false, reason: `Tool not allowed: ${request.tool}` };
    }

    const tool = normalized as ApprovedBookingTool;
    const params = { ...(request.params || {}) };

    for (const key of Object.keys(params)) {
      if (FORBIDDEN_PARAM_KEYS.has(key)) {
        return { allowed: false, reason: 'Tool parameters must not include identity fields.' };
      }
    }

    switch (tool) {
      case 'search_clinics':
        return {
          allowed: true,
          normalizedTool: tool,
          sanitizedParams: { query: String(params.query || params.q || '').slice(0, 500) },
        };

      case 'list_doctors': {
        const clinicId = this.resolveClinicId(params, session);
        if (!clinicId) {
          return { allowed: false, reason: 'Clinic must be selected from a prior search.' };
        }
        return { allowed: true, normalizedTool: tool, sanitizedParams: { clinicId } };
      }

      case 'get_available_slots': {
        const clinicId = this.resolveClinicId(params, session);
        const doctorId = this.resolveDoctorId(params, session);
        const date = String(params.date || session.date || '').slice(0, 10);
        if (!clinicId || !doctorId || !date) {
          return { allowed: false, reason: 'Missing clinic, doctor, or date for slot lookup.' };
        }
        return {
          allowed: true,
          normalizedTool: tool,
          sanitizedParams: { clinicId, doctorId, date },
        };
      }

      case 'book_appointment': {
        const clinicId = session.clinicId;
        const doctorId = session.doctorId;
        const slotId = session.slotId;
        if (!clinicId || !doctorId || !slotId) {
          return { allowed: false, reason: 'Complete booking selection before confirming.' };
        }
        if (session.step !== 'confirm') {
          return { allowed: false, reason: 'Booking requires explicit user confirmation first.' };
        }
        return {
          allowed: true,
          normalizedTool: tool,
          sanitizedParams: { clinicId, doctorId, slotId },
        };
      }

      case 'get_upcoming_appointments':
        return { allowed: true, normalizedTool: tool, sanitizedParams: {} };

      case 'cancel_appointment': {
        const appointmentId = String(params.appointmentId || session.appointmentId || '');
        if (!appointmentId) {
          return { allowed: false, reason: 'No appointment specified to cancel.' };
        }
        const owned = await this.appointmentClient.verifyOwnership(ctx.patientId, appointmentId);
        if (!owned) {
          this.logger.warn({
            correlationId: getCorrelationId(),
            reason: 'ownership_check_failed',
          });
          return { allowed: false, reason: 'You can only cancel your own appointments.' };
        }
        return {
          allowed: true,
          normalizedTool: tool,
          sanitizedParams: {
            appointmentId,
            reason: String(params.reason || 'Cancelled by patient via assistant').slice(0, 500),
          },
        };
      }

      default:
        return { allowed: false, reason: 'Unknown tool.' };
    }
  }

  private normalizeToolName(toolName: string): string {
    const key = (toolName || '').trim().toLowerCase();
    const aliases: Record<string, string> = {
      search_clinic: 'search_clinics',
      search_doctors: 'list_doctors',
      get_slots: 'get_available_slots',
      upcoming_appointments: 'get_upcoming_appointments',
    };
    return aliases[key] || key;
  }

  private resolveClinicId(params: Record<string, unknown>, session: LegacyBookingSession): string | null {
    const requested = String(params.clinicId || '');
    const allowed = new Set<string>();
    if (session.clinicId) allowed.add(session.clinicId);
    for (const c of session.candidates || []) {
      if (c?.id) allowed.add(c.id);
    }
    if (requested) {
      return allowed.has(requested) ? requested : null;
    }
    if (session.clinicId) return session.clinicId;
    if (session.candidates?.[0]?.id) return session.candidates[0].id;
    return null;
  }

  private resolveDoctorId(params: Record<string, unknown>, session: LegacyBookingSession): string | null {
    const requested = String(params.doctorId || '');
    const allowed = new Set<string>();
    if (session.doctorId) allowed.add(session.doctorId);
    for (const d of session.doctorCandidates || []) {
      if (d?.id) allowed.add(d.id);
    }
    if (requested && allowed.has(requested)) return requested;
    if (session.doctorId && allowed.has(session.doctorId)) return session.doctorId;
    if (session.doctorCandidates?.length === 1) return session.doctorCandidates[0].id;
    return null;
  }
}
