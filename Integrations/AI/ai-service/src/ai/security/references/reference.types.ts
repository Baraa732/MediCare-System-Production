export type ReferenceType = 'clinic' | 'doctor' | 'slot' | 'appointment';

export type ReferencePrefix = 'CLN' | 'DOC' | 'SLT' | 'APT';

export const REF_PREFIX_BY_TYPE: Record<ReferenceType, ReferencePrefix> = {
  clinic: 'CLN',
  doctor: 'DOC',
  slot: 'SLT',
  appointment: 'APT',
};

export const REF_TOKEN_PATTERN = /^(CLN|DOC|SLT|APT)-[A-Z0-9]{4}$/;

export const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export interface ReferenceEntry {
  type: ReferenceType;
  id: string;
  createdAt: string;
  parentRef?: string;
  consumed?: boolean;
  consumedAt?: string;
  meta?: {
    name?: string;
    city?: string;
    address?: string;
    specialization?: string;
    scheduledAt?: string;
    startTime?: string;
    status?: string;
  };
}

export interface ReferenceStore {
  entries: Record<string, ReferenceEntry>;
}

export type ReferenceErrorCode =
  | 'unknown_reference'
  | 'expired_reference'
  | 'malformed_reference'
  | 'uuid_not_allowed'
  | 'reference_consumed'
  | 'reference_session_mismatch'
  | 'reference_patient_mismatch';

export class ReferenceError extends Error {
  constructor(
    readonly code: ReferenceErrorCode,
    message?: string,
  ) {
    super(message || code);
  }
}

export type BookingStep =
  | 'start'
  | 'pick_doctor'
  | 'pick_slot'
  | 'confirm_book'
  | 'confirm_modify'
  | 'confirm_cancel'
  | 'completed';

export interface BookingSession {
  step?: BookingStep;
  selectedClinicRef?: string;
  selectedDoctorRef?: string;
  pendingSlotRef?: string;
  pendingAppointmentRef?: string;
  clinicName?: string;
  doctorName?: string;
  date?: string;
  slotTime?: string;
}

export interface ResolvedInternalIds {
  clinicId?: string;
  doctorId?: string;
  slotId?: string;
  appointmentId?: string;
  scheduledAt?: string;
}
