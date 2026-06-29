export interface ApiErrorBody {
  message?: string;
  statusCode?: number;
  code?: string;
  suggestion?: string;
  details?: string[];
}

export class ApiError extends Error {
  status: number;
  code?: string;
  suggestion?: string;

  constructor(
    status: number,
    message: string,
    code?: string,
    suggestion?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.suggestion = suggestion;
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
}

export interface VerifyMfaPasswordChange extends AuthIdentity {
  message: string;
  requiresPasswordChange: true;
  activationToken: string;
}

export type LoginResponse = AuthSession | LoginMfaRequired;

export interface ClinicPublic {
  id: string;
  name: string;
  address?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  status?: string;
  timezone?: string;
  description?: string;
}

export interface StaffMember {
  userId: string;
  clinicId: string;
  staffRole: string;
  status?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phoneNumber?: string;
  specialization?: string;
}

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
  patientId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  reason?: string;
  notes?: string;
}

export interface EnrichedAppointment extends ApiAppointment {
  clinicName?: string;
  doctorName?: string;
  doctorSpecialization?: string;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  status: string;
  clinicId?: string;
  specialization?: string;
  licenseNumber?: string;
  avatarUrl?: string;
  profileData?: Record<string, unknown>;
  createdAt?: string;
}
