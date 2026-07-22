export enum ClinicType {
  PRIVATE_CLINIC = 'private_clinic',
  MEDICAL_CENTER = 'medical_center',
  DENTAL_CLINIC = 'dental_clinic',
  LABORATORY = 'laboratory',
}

export const MEDICAL_SPECIALTIES = [
  'cardiology',
  'dermatology',
  'pediatrics',
  'orthopedics',
  'neurology',
  'gynecology',
  'ophthalmology',
  'ent',
  'urology',
  'psychiatry',
  'general_practice',
  'dentistry',
  'radiology',
  'pathology',
  'emergency_medicine',
] as const;

export type MedicalSpecialty = (typeof MEDICAL_SPECIALTIES)[number];

export const ACTIVATION_DOCUMENT_FIELDS = [
  'nationalId',
  'clinicLicense',
  'governmentId',
  'commercialRegistry',
  'medicalDegree',
  'specializationCertificate',
  'boardCertifications',
] as const;

export type ActivationDocumentField = (typeof ACTIVATION_DOCUMENT_FIELDS)[number];

export const REQUIRED_ACTIVATION_DOCUMENTS: ActivationDocumentField[] = [
  'nationalId',
  'clinicLicense',
  'governmentId',
];
