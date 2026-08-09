import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  FileCheck2,
  KeyRound,
  MapPin,
  Stethoscope,
  UserRound,
} from 'lucide-react'

export const ACTIVATION_ACCENT = '#0ea5e9'
export const ACTIVATION_SECONDARY = '#14b8a6'
export const ACTIVATION_INK = '#0f172a'

export const CLINIC_TYPES = [
  { value: 'private_clinic', label: 'Private Clinic' },
  { value: 'medical_center', label: 'Medical Center' },
  { value: 'dental_clinic', label: 'Dental Clinic' },
  { value: 'laboratory', label: 'Laboratory' },
] as const

export type ClinicTypeValue = (typeof CLINIC_TYPES)[number]['value']

export const MEDICAL_SPECIALTY_OPTIONS = [
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'gynecology', label: 'Gynecology' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent', label: 'ENT' },
  { value: 'urology', label: 'Urology' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'general_practice', label: 'General Practice' },
  { value: 'dentistry', label: 'Dentistry' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pathology', label: 'Pathology' },
  { value: 'emergency_medicine', label: 'Emergency Medicine' },
] as const

export type ActivationDocumentField =
  | 'nationalId'
  | 'clinicLicense'
  | 'governmentId'
  | 'commercialRegistry'
  | 'medicalDegree'
  | 'specializationCertificate'
  | 'boardCertifications'

export const DOCUMENT_FIELD_META: Record<
  ActivationDocumentField,
  { label: string; required: boolean; helper: string }
> = {
  nationalId: {
    label: 'National ID',
    required: true,
    helper: 'Image or PDF of the clinic admin national ID',
  },
  clinicLicense: {
    label: 'Clinic License',
    required: true,
    helper: 'Official clinic operating license',
  },
  governmentId: {
    label: 'Government ID',
    required: true,
    helper: 'Government-issued identification document',
  },
  commercialRegistry: {
    label: 'Commercial Registry',
    required: false,
    helper: 'Optional commercial registration certificate',
  },
  medicalDegree: {
    label: 'Medical Degree Certificate',
    required: false,
    helper: 'Optional medical degree for doctor-led clinics',
  },
  specializationCertificate: {
    label: 'Specialization Certificate',
    required: false,
    helper: 'Optional specialization proof',
  },
  boardCertifications: {
    label: 'Board Certifications',
    required: false,
    helper: 'Optional board certification documents',
  },
}

export type WizardStepId =
  | 'clinic'
  | 'admin'
  | 'legal'
  | 'doctor'
  | 'location'
  | 'review'

export type WizardStepConfig = {
  id: WizardStepId
  label: string
  caption: string
  icon: LucideIcon
  contextTitle: string
  contextBody: string
  tips: string[]
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 'clinic',
    label: 'Clinic',
    caption: 'Official clinic identity & specialties',
    icon: Building2,
    contextTitle: 'Define the clinic entity',
    contextBody: 'Capture the licensed clinic profile that will be bound to the activation code.',
    tips: ['Use the official registered name', 'Select all active specialties', 'License number must match documents'],
  },
  {
    id: 'admin',
    label: 'Admin',
    caption: 'Primary clinic administrator',
    icon: UserRound,
    contextTitle: 'Identify the clinic admin',
    contextBody: 'This person will receive the activation code and complete clinic admin onboarding.',
    tips: ['Phone must match Syrian format', 'WhatsApp used for operational alerts', 'ID must match uploaded documents'],
  },
  {
    id: 'legal',
    label: 'Legal',
    caption: 'Verification documents',
    icon: FileCheck2,
    contextTitle: 'Upload verification files',
    contextBody: 'Required documents are stored securely with the activation record before the code is issued.',
    tips: ['JPEG, PNG, WebP, or PDF up to 10 MB', 'Ensure scans are readable', 'Commercial registry is optional'],
  },
  {
    id: 'doctor',
    label: 'Doctor',
    caption: 'Optional medical credentials',
    icon: Stethoscope,
    contextTitle: 'Doctor credentials (optional)',
    contextBody: 'Add medical credentials when the clinic is physician-led or requires specialist verification.',
    tips: ['Skip if not applicable', 'Certificates can be added later in tenant setup', 'Years of experience helps routing'],
  },
  {
    id: 'location',
    label: 'Location',
    caption: 'Map pin & service radius',
    icon: MapPin,
    contextTitle: 'Pin the clinic on the map',
    contextBody: 'Location is mandatory. Search, click, or drag the pin — coordinates are saved atomically with the code.',
    tips: ['Use search for landmarks', 'Drag pin for exact building placement', 'Set coverage radius for service area'],
  },
  {
    id: 'review',
    label: 'Issue',
    caption: 'Review & generate code',
    icon: KeyRound,
    contextTitle: 'Final review before issuance',
    contextBody: 'Confirm all data, set billing flags, then generate a single-use activation code for the clinic admin.',
    tips: ['Code expires in 24 hours', 'Location cannot be added later', 'Revoke pending codes anytime'],
  },
]

export const REQUIRED_ACTIVATION_DOCUMENTS: ActivationDocumentField[] = [
  'nationalId',
  'clinicLicense',
  'governmentId',
]
