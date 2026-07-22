import { z } from 'zod'

export const activationProvisioningSchema = z.object({
  clinicName: z.string().min(2, 'Clinic name is required'),
  clinicType: z.enum(['private_clinic', 'medical_center', 'dental_clinic', 'laboratory']),
  registrationLicenseNumber: z.string().min(2, 'Registration / license number is required'),
  establishmentDate: z.string().optional(),
  specialties: z.array(z.string()).min(1, 'Select at least one specialty'),

  fullName: z.string().min(2, 'Full name is required'),
  phoneNumber: z.string().min(8, 'Phone number is required'),
  whatsappNumber: z.string().min(8, 'WhatsApp number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  idNumber: z.string().min(5, 'ID number is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),

  yearsOfExperience: z.number().min(0).optional(),

  price: z.number().min(0, 'Price must be 0 or more'),
  isCashPaymentDone: z.boolean(),
  notes: z.string().optional(),
})

export type ActivationProvisioningForm = z.infer<typeof activationProvisioningSchema>

export const stepFieldMap = {
  clinic: ['clinicName', 'clinicType', 'registrationLicenseNumber', 'establishmentDate', 'specialties'] as const,
  admin: ['fullName', 'phoneNumber', 'whatsappNumber', 'email', 'idNumber', 'dateOfBirth'] as const,
  doctor: ['yearsOfExperience'] as const,
  review: ['price', 'isCashPaymentDone', 'notes'] as const,
} satisfies Record<string, readonly (keyof ActivationProvisioningForm)[]>
