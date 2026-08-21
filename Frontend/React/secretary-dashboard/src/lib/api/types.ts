export interface ApiErrorBody {
  message?: string;
  statusCode?: number;
  code?: string;
  suggestion?: string;
  details?: string[] | string | Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  suggestion?: string;
  details?: string[] | string | Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    code?: string,
    suggestion?: string,
    details?: string[] | string | Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.suggestion = suggestion;
    this.details = details;
  }
}

export interface AuthIdentity {
  userId: string;
  role: string;
  tenantId?: string;
  clinicId?: string;
}

export interface AuthSession extends AuthIdentity {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface LoginMfaRequired extends AuthIdentity {
  message: string;
  requiresMfa: true;
  mfaToken: string;
  requiresPasswordChange?: boolean;
  whatsappSent?: boolean;
  whatsappHint?: string;
}

export interface VerifyMfaPasswordChange extends AuthIdentity {
  message: string;
  requiresPasswordChange: true;
  activationToken: string;
}

export type LoginResponse = AuthSession | LoginMfaRequired;

export interface ClinicDoctor {
  userId: string;
  clinicId: string;
  staffRole: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  specialization?: string;
}

export interface ApiAppointment {
  id: string;
  clinicId: string;
  doctorId: string;
  patientId?: string | null;
  guestPatientName?: string | null;
  guestPatientPhone?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  reason?: string;
  notes?: string;
  /** Optional metadata when backend / gateway enriches the payload. */
  complexity?: string | null;
  refuseTransfer?: boolean | null;
  lockedToDoctor?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface EnrichedAppointment extends ApiAppointment {
  clinicName?: string;
  clinicAddress?: string;
  clinicCity?: string;
  clinicGovernorate?: string;
  clinicPhone?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  patientName?: string;
  patientPhone?: string;
  patientGender?: string;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  status: string;
  isPhoneVerified?: boolean;
  isDashboardActivated?: boolean;
  clinicId?: string;
  specialization?: string;
  profileData?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
