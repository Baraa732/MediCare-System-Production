import { z } from 'zod';
import { REF_TOKEN_PATTERN, UUID_PATTERN } from '../references/reference.types';

const noUuidString = z
  .string()
  .refine((v) => !UUID_PATTERN.test(v), { message: 'uuid_not_allowed' });

export const clinicRefSchema = noUuidString.refine((v) => REF_TOKEN_PATTERN.test(v) && v.startsWith('CLN-'), {
  message: 'malformed_reference',
});

export const doctorRefSchema = noUuidString.refine((v) => REF_TOKEN_PATTERN.test(v) && v.startsWith('DOC-'), {
  message: 'malformed_reference',
});

export const slotRefSchema = noUuidString.refine((v) => REF_TOKEN_PATTERN.test(v) && v.startsWith('SLT-'), {
  message: 'malformed_reference',
});

export const appointmentRefSchema = noUuidString.refine(
  (v) => REF_TOKEN_PATTERN.test(v) && v.startsWith('APT-'),
  { message: 'malformed_reference' },
);

export const searchClinicsSchema = z
  .object({
    query: z.string().max(500),
  })
  .strict();

export const listDoctorsSchema = z
  .object({
    clinicRef: clinicRefSchema,
  })
  .strict();

export const getAvailableSlotsSchema = z
  .object({
    clinicRef: clinicRefSchema,
    doctorRef: doctorRefSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const getUpcomingAppointmentsSchema = z.object({}).strict();

export const bookAppointmentSchema = z
  .object({
    slotRef: slotRefSchema,
  })
  .strict();

export const modifyAppointmentSchema = z
  .object({
    appointmentRef: appointmentRefSchema,
    slotRef: slotRefSchema,
  })
  .strict();

export const cancelAppointmentSchema = z
  .object({
    appointmentRef: appointmentRefSchema,
    reason: z.string().max(500).optional(),
  })
  .strict();

export const TOOL_SCHEMAS = {
  search_clinics: searchClinicsSchema,
  list_doctors: listDoctorsSchema,
  get_available_slots: getAvailableSlotsSchema,
  get_upcoming_appointments: getUpcomingAppointmentsSchema,
  book_appointment: bookAppointmentSchema,
  modify_appointment: modifyAppointmentSchema,
  cancel_appointment: cancelAppointmentSchema,
} as const;

export type ToolSchemaName = keyof typeof TOOL_SCHEMAS;

export function validateToolParams(tool: string, params: unknown): {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
} {
  const schema = TOOL_SCHEMAS[tool as ToolSchemaName];
  if (!schema) {
    return { success: false, error: 'unknown_tool' };
  }
  const result = schema.safeParse(params ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    return { success: false, error: issue?.message || 'schema_violation' };
  }
  return { success: true, data: result.data as Record<string, unknown> };
}

/** Reject any param key that looks like a raw ID field from LLM. */
export function containsForbiddenIdKeys(params: Record<string, unknown>): boolean {
  const forbidden = [
    'patientId',
    'userId',
    'clinicId',
    'doctorId',
    'slotId',
    'appointmentId',
    'authorization',
    'token',
  ];
  return Object.keys(params).some((k) => forbidden.includes(k));
}
