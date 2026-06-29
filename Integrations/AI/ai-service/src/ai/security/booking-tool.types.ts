export { APPROVED_BOOKING_TOOLS, type ApprovedBookingTool } from './approved-tools';

export interface ToolCallRequest {
  tool: string;
  params: Record<string, unknown>;
}

export interface PolicyContext {
  patientId: string;
  sessionId: string;
  userMessage: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  normalizedTool?: import('./approved-tools').ApprovedBookingTool;
  sanitizedParams?: Record<string, unknown>;
}

export interface ToolExecutionContext extends PolicyContext {
  authHeader?: string;
}

export interface ToolResultPayload {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
