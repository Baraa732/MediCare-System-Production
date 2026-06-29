import { Injectable, Logger } from '@nestjs/common';
import { ClinicHttpClient, Clinic, Doctor } from './clinic-http.client';
import { SchedulingHttpClient, Slot } from './scheduling-http.client';
import { AppointmentHttpClient } from './appointment-http.client-v2';
import { UserHttpClient } from './user-http.client';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

@Injectable()
export class BookingToolsService {
  private readonly logger = new Logger(BookingToolsService.name);

  constructor(
    private clinicClient: ClinicHttpClient,
    private userClient: UserHttpClient,
    private schedulingClient: SchedulingHttpClient,
    private appointmentClient: AppointmentHttpClient,
  ) {}

  async searchClinics(query: string, authHeader?: string): Promise<ToolResult> {
    const clinics = await this.clinicClient.searchClinics(query, authHeader);
    return { success: true, data: { clinics } };
  }

  async listDoctors(clinicId: string, authHeader?: string): Promise<ToolResult> {
    const doctors = await this.clinicClient.listDoctors(clinicId, authHeader);
    return { success: true, data: { doctors } };
  }

  async searchDoctorsByName(name: string, authHeader?: string): Promise<ToolResult> {
    const terms = this.extractDoctorSearchTerms(name);
    if (terms.length === 0) return { success: true, data: { doctors: [] } };

    const clinics = await this.clinicClient.listClinics(authHeader);
    const scan = Array.isArray(clinics) ? clinics.slice(0, 50) : [];
    const perClinic = await Promise.all(
      scan.map(async (clinic: any) => ({
        clinic,
        doctors: await this.clinicClient.listDoctors(clinic.id, authHeader),
      })),
    );

    const assignedMatches = perClinic.flatMap(({ clinic, doctors }) =>
      (doctors || [])
        .filter((doctor: any) => this.matchesDoctorTerms(doctor, terms))
        .map((doctor: any) => ({
          ...doctor,
          clinicId: clinic.id,
          clinicName: clinic.name,
          clinicCity: (clinic as any).city,
        })),
    );

    const idsFromUserService = new Set<string>();
    for (const term of terms) {
      for (const id of await this.userClient.searchDoctorIds(term)) {
        idsFromUserService.add(id);
      }
    }

    const profiles = await this.userClient.getPublicDoctors([...idsFromUserService]);
    const profileMatches = profiles
      .filter((doctor: any) => this.matchesDoctorTerms(doctor, terms))
      .map((doctor: any) => {
        const assigned = assignedMatches.find((m: any) => m.userId === doctor.id || m.id === doctor.id);
        return {
          ...doctor,
          ...(assigned || {}),
          id: doctor.id,
          clinicName: assigned?.clinicName,
          clinicCity: assigned?.clinicCity,
          assignmentStatus: assigned ? 'ASSIGNED' : 'NO_ACTIVE_CLINIC_ASSIGNMENT',
        };
      });

    const byId = new Map<string, any>();
    for (const doctor of [...assignedMatches, ...profileMatches]) {
      const id = this.doctorIdentity(doctor);
      if (!byId.has(id)) {
        byId.set(id, doctor);
      } else {
        byId.set(id, { ...doctor, ...byId.get(id) });
      }
    }

    return { success: true, data: { doctors: [...byId.values()], terms } };
  }

  private doctorIdentity(doctor: any): string {
    return (
      doctor.userId ||
      doctor.id ||
      `${doctor.firstName || ''}-${doctor.lastName || ''}-${doctor.specialization || ''}`.toLowerCase()
    );
  }

  private extractDoctorSearchTerms(input: string): string[] {
    const cleaned = input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(
        (word) =>
          ![
            'search',
            'me',
            'about',
            'doctor',
            'with',
            'name',
            'named',
            'or',
            'something',
            'like',
            'loke',
            'that',
            'maybe',
            'contain',
            'contains',
            'please',
            'find',
            'for',
          ].includes(word),
      );

    return [...new Set(cleaned.filter((word) => word.length >= 3))].slice(0, 5);
  }

  private matchesDoctorTerms(doctor: any, terms: string[]): boolean {
    const haystack = [
      doctor.name,
      doctor.fullName,
      doctor.firstName,
      doctor.lastName,
      doctor.specialization,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack || terms.length === 0) return false;
    return terms.some((term) => haystack.includes(term) || this.isNearMatch(haystack, term));
  }

  private isNearMatch(text: string, term: string): boolean {
    // Handles simple Ahmad/Ahmed-style spelling variation without expensive fuzzy search.
    const variants = new Set([
      term,
      term.replace(/a/g, 'e'),
      term.replace(/e/g, 'a'),
      term.replace(/ah/g, 'a'),
      term.replace(/med$/, 'mad'),
      term.replace(/mad$/, 'med'),
    ]);
    return [...variants].some((variant) => variant.length >= 3 && text.includes(variant));
  }

  async getAvailableSlots(
    clinicId: string,
    doctorId: string,
    date: string,
    authHeader?: string,
  ): Promise<ToolResult> {
    const slots = await this.schedulingClient.getAvailableSlots(clinicId, doctorId, date, authHeader);
    return { success: true, data: { slots } };
  }

  async bookAppointment(
    patientId: string,
    clinicId: string,
    doctorId: string,
    scheduledAt: string,
    authHeader?: string,
  ): Promise<ToolResult> {
    const validation = await this.schedulingClient.validateSlotForTime(
      clinicId,
      doctorId,
      scheduledAt,
    );
    if (!validation.valid) {
      return { success: false, error: 'Slot no longer available' };
    }

    const result = await this.appointmentClient.bookAppointment(
      patientId,
      clinicId,
      doctorId,
      scheduledAt,
      authHeader,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: { appointmentId: result.appointmentId } };
  }

  async updateAppointment(
    appointmentId: string,
    scheduledAt: string,
    authHeader?: string,
  ): Promise<ToolResult> {
    const result = await this.appointmentClient.updateAppointment(
      appointmentId,
      scheduledAt,
      authHeader,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: {} };
  }

  async cancelAppointment(
    patientId: string,
    appointmentId: string,
    reason: string | undefined,
    authHeader?: string,
  ): Promise<ToolResult> {
    const owned = await this.appointmentClient.verifyOwnership(patientId, appointmentId);
    if (!owned) {
      return { success: false, error: 'Appointment not found or access denied' };
    }

    const result = await this.appointmentClient.cancelAppointment(
      appointmentId,
      reason,
      authHeader,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: {} };
  }

  async getUpcomingAppointments(patientId: string): Promise<ToolResult> {
    const appointments = await this.appointmentClient.getPatientUpcomingSummary(patientId);
    return { success: true, data: { appointments } };
  }
}
