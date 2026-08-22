/**
 * Secretary dashboard stores scheduling + guest demographics inside appointment.notes JSON.
 */

export function parseAppointmentNotesMetadata(
  notes?: string | null,
): Record<string, unknown> {
  if (!notes?.trim()) return {};
  const trimmed = notes.trim();
  if (!trimmed.startsWith('{')) return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeWizardGender(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'male' || v === 'm') return 'MALE';
  if (v === 'female' || v === 'f') return 'FEMALE';
  return value.trim().toUpperCase();
}

function parseAge(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const age = Math.floor(value);
    return age >= 0 && age <= 120 ? age : undefined;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const age = parseInt(value.trim(), 10);
    return age >= 0 && age <= 120 ? age : undefined;
  }
  return undefined;
}

export function resolveDemographicsFromNotes(notes?: string | null): {
  gender?: string;
  birthDate?: string;
} {
  const meta = parseAppointmentNotesMetadata(notes);
  const gender = normalizeWizardGender(
    typeof meta.patientGender === 'string' ? meta.patientGender : undefined,
  );
  const age = parseAge(meta.patientAge);
  const birthDate =
    age != null ? `${new Date().getFullYear() - age}-01-01` : undefined;
  return { gender, birthDate };
}

export function mergePatientDemographics(
  patient?: { gender?: string; birthDate?: string } | null,
  notes?: string | null,
): { patientGender?: string; patientBirthDate?: string } {
  const fromNotes = resolveDemographicsFromNotes(notes);
  return {
    patientGender: patient?.gender ?? fromNotes.gender,
    patientBirthDate: patient?.birthDate ?? fromNotes.birthDate,
  };
}
