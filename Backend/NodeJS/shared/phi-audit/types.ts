export type PhiAuditClassification = 'phi' | 'administrative' | 'security';

export enum PhiAuditAction {
  EMR_CHART_READ = 'emr.chart.read',
  EMR_CHART_WRITE = 'emr.chart.write',
  APPOINTMENT_READ = 'appointment.read',
  APPOINTMENT_CREATE = 'appointment.create',
  APPOINTMENT_UPDATE = 'appointment.update',
  APPOINTMENT_DELETE = 'appointment.delete',
  PATIENT_PROFILE_READ = 'patient.profile.read',
  PATIENT_LOOKUP_PHONE = 'patient.lookup.phone',
  INTERNAL_PHI_ACCESS = 'internal.phi.access',
}

export enum PhiAuditResourceType {
  EMR_CHART = 'emr_chart',
  APPOINTMENT = 'appointment',
  PATIENT = 'patient',
  CLINIC_ADMIN_ACTIVATION = 'clinic_admin_activation',
  SYSTEM = 'system',
}

export interface PhiAuditEvent {
  timestamp: string;
  actorId?: string;
  actorRole?: string;
  tenantId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  success: boolean;
  classification: PhiAuditClassification;
  sourceService?: string;
  internalCall?: boolean;
}

export const AUDIT_LOG_TOPIC = 'audit.log';
