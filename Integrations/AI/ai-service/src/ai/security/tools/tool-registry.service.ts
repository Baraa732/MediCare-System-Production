import { Injectable } from '@nestjs/common';
import { APPROVED_BOOKING_TOOLS, ApprovedBookingTool } from '../approved-tools';
import { BookingStep } from '../references/reference.types';
import { TOOL_SCHEMAS, validateToolParams } from './tool-schemas';

export type ToolAuthRequirement = 'none' | 'patient_jwt';

export interface ToolDefinition {
  name: ApprovedBookingTool;
  auth: ToolAuthRequirement;
  requiresConfirmStep?: BookingStep;
}

@Injectable()
export class ToolRegistry {
  private readonly definitions: Map<ApprovedBookingTool, ToolDefinition> = new Map([
    ['search_clinics', { name: 'search_clinics', auth: 'none' }],
    ['list_doctors', { name: 'list_doctors', auth: 'none' }],
    ['get_available_slots', { name: 'get_available_slots', auth: 'none' }],
    ['get_upcoming_appointments', { name: 'get_upcoming_appointments', auth: 'patient_jwt' }],
    ['book_appointment', { name: 'book_appointment', auth: 'patient_jwt', requiresConfirmStep: 'confirm_book' }],
    ['modify_appointment', { name: 'modify_appointment', auth: 'patient_jwt', requiresConfirmStep: 'confirm_modify' }],
    ['cancel_appointment', { name: 'cancel_appointment', auth: 'patient_jwt', requiresConfirmStep: 'confirm_cancel' }],
  ]);

  normalizeToolName(toolName: string): ApprovedBookingTool | null {
    const key = (toolName || '').trim().toLowerCase();
    const aliases: Record<string, ApprovedBookingTool> = {
      search_clinic: 'search_clinics',
      search_doctors: 'list_doctors',
      get_slots: 'get_available_slots',
      upcoming_appointments: 'get_upcoming_appointments',
    };
    const normalized = aliases[key] || key;
    return APPROVED_BOOKING_TOOLS.includes(normalized as ApprovedBookingTool)
      ? (normalized as ApprovedBookingTool)
      : null;
  }

  getDefinition(tool: ApprovedBookingTool): ToolDefinition | undefined {
    return this.definitions.get(tool);
  }

  validateParams(tool: ApprovedBookingTool, params: unknown) {
    return validateToolParams(tool, params);
  }

  listApproved(): ApprovedBookingTool[] {
    return [...APPROVED_BOOKING_TOOLS];
  }

  hasSchema(tool: string): boolean {
    return tool in TOOL_SCHEMAS;
  }
}
