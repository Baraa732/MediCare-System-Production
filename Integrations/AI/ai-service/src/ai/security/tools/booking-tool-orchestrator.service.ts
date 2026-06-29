import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingToolsService } from '../../services/booking-tools.service';
import { BookingSessionService } from '../../services/booking-session.service';
import { AppointmentHttpClient } from '../../services/appointment-http.client-v2';
import {
  ApprovedBookingTool,
  PolicyDecision,
  ToolExecutionContext,
  ToolResultPayload,
} from '../booking-tool.types';
import { ReferenceError } from '../references/reference.types';
import { ReferenceResolverService } from '../references/reference-resolver.service';
import { BookingSession } from '../references/reference.types';
import { containsForbiddenIdKeys } from './tool-schemas';
import { ToolRegistry } from './tool-registry.service';
import { ToolResultSanitizerService } from '../tool-result-sanitizer.service';
import { getCorrelationId } from '../secure-logging';

@Injectable()
export class BookingToolOrchestrator {
  private readonly logger = new Logger(BookingToolOrchestrator.name);

  constructor(
    private registry: ToolRegistry,
    private resolver: ReferenceResolverService,
    private tools: BookingToolsService,
    private sessions: BookingSessionService,
    private appointments: AppointmentHttpClient,
    private sanitizer: ToolResultSanitizerService,
    private config: ConfigService,
  ) {}

  isSafeRefsEnabled(): boolean {
    const flag = this.config.get<string>('BOOKING_USE_SAFE_REFS');
    return flag !== 'false';
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    ctx: ToolExecutionContext,
    session: BookingSession,
  ): Promise<{ result: ToolResultPayload; summary: string; session: BookingSession }> {
    const normalized = this.registry.normalizeToolName(toolName);
    if (!normalized) {
      return this.denied(toolName, 'Tool not allowed', session);
    }

    if (containsForbiddenIdKeys(params)) {
      return this.denied(normalized, 'Tool parameters must not include identity fields', session);
    }

    const schemaCheck = this.registry.validateParams(normalized, params);
    if (!schemaCheck.success) {
      return this.denied(normalized, schemaCheck.error || 'schema_violation', session);
    }

    const parsed = schemaCheck.data || {};
    let policy: PolicyDecision;
    try {
      policy = await this.validatePolicy(normalized, parsed, ctx, session);
    } catch (error) {
      if (error instanceof ReferenceError) {
        return this.denied(normalized, error.code, session);
      }
      this.logger.error({ correlationId: getCorrelationId(), reason: 'tool_policy_failed' });
      return this.denied(normalized, 'Operation failed', session);
    }
    if (!policy.allowed) {
      return this.denied(normalized, policy.reason || 'not allowed', session);
    }

    try {
      const result = await this.runTool(normalized, policy.sanitizedParams || parsed, ctx, session);
      const updated = await this.applySessionUpdates(normalized, result, session, ctx, policy.sanitizedParams || parsed);
      await this.sessions.save(ctx.patientId, ctx.sessionId, updated);
      const summary = this.sanitizer.summarize(normalized, result);
      return { result, summary, session: updated };
    } catch (error) {
      if (error instanceof ReferenceError) {
        return this.denied(normalized, error.code, session);
      }
      this.logger.error({ correlationId: getCorrelationId(), reason: 'tool_execution_failed' });
      return this.denied(normalized, 'Operation failed', session);
    }
  }

  private async validatePolicy(
    tool: ApprovedBookingTool,
    params: Record<string, unknown>,
    ctx: ToolExecutionContext,
    session: BookingSession,
  ): Promise<PolicyDecision> {
    const def = this.registry.getDefinition(tool);
    if (!def) return { allowed: false, reason: 'Unknown tool' };
    if (def.auth === 'patient_jwt' && !ctx.authHeader) {
      return { allowed: false, reason: 'Authentication required' };
    }
    if (def.requiresConfirmStep && session.step !== def.requiresConfirmStep) {
      return { allowed: false, reason: 'Explicit user confirmation required first' };
    }

    switch (tool) {
      case 'search_clinics':
        return { allowed: true, normalizedTool: tool, sanitizedParams: params };
      case 'list_doctors':
        await this.resolver.resolve(ctx.patientId, ctx.sessionId, String(params.clinicRef), 'clinic');
        return { allowed: true, normalizedTool: tool, sanitizedParams: params };
      case 'get_available_slots':
        await this.resolver.resolve(ctx.patientId, ctx.sessionId, String(params.clinicRef), 'clinic');
        await this.resolver.resolve(ctx.patientId, ctx.sessionId, String(params.doctorRef), 'doctor');
        return { allowed: true, normalizedTool: tool, sanitizedParams: params };
      case 'get_upcoming_appointments':
        return { allowed: true, normalizedTool: tool, sanitizedParams: {} };
      case 'book_appointment':
        await this.resolver.resolve(ctx.patientId, ctx.sessionId, String(params.slotRef), 'slot');
        return { allowed: true, normalizedTool: tool, sanitizedParams: params };
      case 'modify_appointment': {
        const aptId = await this.resolver.resolveId(
          ctx.patientId,
          ctx.sessionId,
          String(params.appointmentRef),
          'appointment',
        );
        const owned = await this.appointments.verifyOwnership(ctx.patientId, aptId);
        if (!owned) return { allowed: false, reason: 'You can only modify your own appointments.' };
        await this.resolver.resolve(ctx.patientId, ctx.sessionId, String(params.slotRef), 'slot');
        return { allowed: true, normalizedTool: tool, sanitizedParams: params };
      }
      case 'cancel_appointment': {
        const aptId = await this.resolver.resolveId(
          ctx.patientId,
          ctx.sessionId,
          String(params.appointmentRef),
          'appointment',
        );
        const owned = await this.appointments.verifyOwnership(ctx.patientId, aptId);
        if (!owned) return { allowed: false, reason: 'You can only cancel your own appointments.' };
        return { allowed: true, normalizedTool: tool, sanitizedParams: params };
      }
      default:
        return { allowed: false, reason: 'Unknown tool' };
    }
  }

  private async runTool(
    tool: ApprovedBookingTool,
    params: Record<string, unknown>,
    ctx: ToolExecutionContext,
    session: BookingSession,
  ): Promise<ToolResultPayload> {
    const { patientId, sessionId, authHeader } = ctx;

    switch (tool) {
      case 'search_clinics': {
        const raw = await this.tools.searchClinics(String(params.query), authHeader);
        if (!raw.success) return raw;
        const clinics: Array<{ clinicRef: string; name?: string; city?: string; address?: string }> = [];
        for (const c of raw.data?.clinics || []) {
          const clinicRef = await this.resolver.allocate(patientId, sessionId, 'clinic', c.id, {
            name: c.name,
            city: c.city,
            address: c.address,
          });
          clinics.push({
            clinicRef,
            name: c.name,
            city: c.city,
            address: c.address,
          });
        }
        return { success: true, data: { clinics } };
      }
      case 'list_doctors': {
        const clinicId = await this.resolver.resolveId(
          patientId,
          sessionId,
          String(params.clinicRef),
          'clinic',
        );
        const raw = await this.tools.listDoctors(clinicId, authHeader);
        if (!raw.success) return raw;
        const doctors: Array<{ doctorRef: string; name: string; specialization?: string }> = [];
        for (const d of raw.data?.doctors || []) {
          const id = d.id || (d as any).userId;
          const name =
            d.name ||
            [d.firstName, d.lastName].filter(Boolean).join(' ').trim() ||
            (d as any).fullName ||
            'Doctor';
          const doctorRef = await this.resolver.allocate(patientId, sessionId, 'doctor', id, {
            name,
            specialization: d.specialization,
          }, String(params.clinicRef));
          doctors.push({ doctorRef, name, specialization: d.specialization });
        }
        return { success: true, data: { doctors, clinicRef: params.clinicRef } };
      }
      case 'get_available_slots': {
        const clinicId = await this.resolver.resolveId(patientId, sessionId, String(params.clinicRef), 'clinic');
        const doctorId = await this.resolver.resolveId(patientId, sessionId, String(params.doctorRef), 'doctor');
        const date = String(params.date);
        const raw = await this.tools.getAvailableSlots(clinicId, doctorId, date, authHeader);
        if (!raw.success) return raw;
        const slots: Array<{ slotRef: string; startTime?: string }> = [];
        for (const s of raw.data?.slots || []) {
          const slotId = s.id || (s as any).slotId || `${doctorId}-${s.startTime}`;
          const scheduledAt =
            this.buildScheduledAt(date, s.startTime || (s as any).time) || undefined;
          const slotRef = await this.resolver.allocate(
            patientId,
            sessionId,
            'slot',
            slotId,
            { startTime: s.startTime || (s as any).time, scheduledAt },
            String(params.doctorRef),
          );
          slots.push({
            slotRef,
            startTime: s.startTime || (s as any).time,
          });
        }
        return { success: true, data: { slots, date, clinicRef: params.clinicRef, doctorRef: params.doctorRef } };
      }
      case 'get_upcoming_appointments': {
        const raw = await this.tools.getUpcomingAppointments(patientId);
        if (!raw.success) return raw;
        const appointments: Array<{
          appointmentRef: string;
          clinicName?: string;
          doctorName?: string;
          scheduledAt?: string;
          status?: string;
        }> = [];
        for (const a of raw.data?.appointments || []) {
          const aptRef = await this.resolver.allocate(patientId, sessionId, 'appointment', a.appointmentId, {
            name: a.clinicName,
            scheduledAt: a.scheduledAt,
            status: a.status,
          });
          appointments.push({
            appointmentRef: aptRef,
            clinicName: a.clinicName,
            doctorName: a.doctorName,
            scheduledAt: a.scheduledAt,
            status: a.status,
          });
        }
        return { success: true, data: { appointments } };
      }
      case 'book_appointment': {
        const slotEntry = await this.resolver.resolve(patientId, sessionId, String(params.slotRef), 'slot');
        const doctorRef = session.selectedDoctorRef || slotEntry.parentRef;
        if (!doctorRef) return { success: false, error: 'Missing doctor context' };
        const clinicRef = session.selectedClinicRef;
        if (!clinicRef) return { success: false, error: 'Missing clinic context' };
        const clinicId = await this.resolver.resolveId(patientId, sessionId, clinicRef, 'clinic');
        const doctorId = await this.resolver.resolveId(patientId, sessionId, doctorRef, 'doctor');
        const scheduledAt =
          slotEntry.meta?.scheduledAt ||
          this.buildScheduledAt(session.date, slotEntry.meta?.startTime || session.slotTime);
        if (!scheduledAt) return { success: false, error: 'Missing schedule time' };
        const raw = await this.tools.bookAppointment(patientId, clinicId, doctorId, scheduledAt, authHeader);
        if (!raw.success) return raw;
        await this.resolver.markConsumed(patientId, sessionId, String(params.slotRef));
        let appointmentRef: string | undefined;
        if (raw.data?.appointmentId) {
          appointmentRef = await this.resolver.allocate(patientId, sessionId, 'appointment', String(raw.data.appointmentId), {
            scheduledAt,
            status: 'CONFIRMED',
          });
        }
        return { success: true, data: { appointmentRef } };
      }
      case 'modify_appointment': {
        const appointmentId = await this.resolver.resolveId(
          patientId,
          sessionId,
          String(params.appointmentRef),
          'appointment',
        );
        const slotEntry = await this.resolver.resolve(patientId, sessionId, String(params.slotRef), 'slot');
        const scheduledAt =
          slotEntry.meta?.scheduledAt ||
          this.buildScheduledAt(session.date, slotEntry.meta?.startTime);
        if (!scheduledAt) return { success: false, error: 'Missing schedule time' };
        const raw = await this.tools.updateAppointment(appointmentId, scheduledAt, authHeader);
        if (!raw.success) return raw;
        await this.resolver.markConsumed(patientId, sessionId, String(params.slotRef));
        return { success: true, data: {} };
      }
      case 'cancel_appointment': {
        const appointmentId = await this.resolver.resolveId(
          patientId,
          sessionId,
          String(params.appointmentRef),
          'appointment',
        );
        const raw = await this.tools.cancelAppointment(
          patientId,
          appointmentId,
          String(params.reason || ''),
          authHeader,
        );
        if (!raw.success) return raw;
        await this.resolver.markConsumed(patientId, sessionId, String(params.appointmentRef));
        return { success: true, data: {} };
      }
      default:
        return { success: false, error: 'Unknown tool' };
    }
  }

  private async applySessionUpdates(
    tool: ApprovedBookingTool,
    result: ToolResultPayload,
    session: BookingSession,
    ctx: ToolExecutionContext,
    params: Record<string, unknown>,
  ): Promise<BookingSession> {
    if (!result.success) return session;
    const next = { ...session };

    if (tool === 'search_clinics' && Array.isArray(result.data?.clinics)) {
      const clinics = result.data.clinics as Array<{ clinicRef: string; name?: string }>;
      if (clinics.length > 0) {
        next.selectedClinicRef = clinics[0].clinicRef;
        next.clinicName = clinics[0].name;
        next.step = 'pick_doctor';
      }
    }

    if (tool === 'list_doctors' && Array.isArray(result.data?.doctors)) {
      const doctors = result.data.doctors as Array<{ doctorRef: string; name?: string }>;
      next.selectedClinicRef = String(params.clinicRef);
      if (doctors.length === 1) {
        next.selectedDoctorRef = doctors[0].doctorRef;
        next.doctorName = doctors[0].name;
      }
      next.step = 'pick_slot';
    }

    if (tool === 'get_available_slots' && Array.isArray(result.data?.slots)) {
      const slots = result.data.slots as Array<{ slotRef: string; startTime?: string }>;
      next.selectedClinicRef = String(params.clinicRef);
      next.selectedDoctorRef = String(params.doctorRef);
      next.date = String(params.date);
      if (slots.length === 1) {
        next.pendingSlotRef = slots[0].slotRef;
        next.slotTime = slots[0].startTime;
        next.step = 'confirm_book';
      }
    }

    if (tool === 'book_appointment' && result.data?.appointmentRef) {
      next.pendingAppointmentRef = String(result.data.appointmentRef);
      next.step = 'completed';
    }

    if (tool === 'cancel_appointment') {
      next.pendingAppointmentRef = undefined;
      next.step = 'start';
    }

    return next;
  }

  private buildScheduledAt(date?: string, slotTime?: string): string | null {
    if (!date || !slotTime) return slotTime && slotTime.includes('T') ? slotTime : null;
    if (slotTime.includes('T')) return slotTime;
    const time = slotTime.length === 5 ? `${slotTime}:00` : slotTime;
    return `${date}T${time}.000Z`;
  }

  private denied(
    tool: string,
    reason: string,
    session: BookingSession,
  ): { result: ToolResultPayload; summary: string; session: BookingSession } {
    const result = { success: false, error: reason };
    const normalized = this.registry.normalizeToolName(tool);
    const summary = normalized
      ? this.sanitizer.summarize(normalized, result)
      : `Tool denied: ${reason}`;
    return { result, summary, session };
  }
}
