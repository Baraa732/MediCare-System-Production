import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { activationProvisioningSchema, stepFieldMap, type ActivationProvisioningForm } from '../activationSchema'
import {
  REQUIRED_ACTIVATION_DOCUMENTS,
  WIZARD_STEPS,
  type ActivationDocumentField,
} from '../activationConstants'
import { DEFAULT_SERVICE_RADIUS_KM } from '../clinicMapConstants'
import { provisionActivationCode } from '../../../api/systemManager'
import { normalizeError } from '../../../api/errors'
import { notify } from '../../../lib/toast'

const EMPTY_DOCUMENTS: Record<ActivationDocumentField, File | null> = {
  nationalId: null,
  clinicLicense: null,
  governmentId: null,
  commercialRegistry: null,
  medicalDegree: null,
  specializationCertificate: null,
  boardCertifications: null,
}

export function useActivationProvisioning(token: string | null, onGenerated: (result: { code: string; expiresAt: string }) => void) {
  const [activeStep, setActiveStep] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mapLatitude, setMapLatitude] = useState<number | null>(null)
  const [mapLongitude, setMapLongitude] = useState<number | null>(null)
  const [mapAddress, setMapAddress] = useState('')
  const [serviceRadiusKm, setServiceRadiusKm] = useState(DEFAULT_SERVICE_RADIUS_KM)
  const [documents, setDocuments] = useState(EMPTY_DOCUMENTS)

  const form = useForm<ActivationProvisioningForm>({
    resolver: zodResolver(activationProvisioningSchema),
    mode: 'onChange',
    defaultValues: {
      clinicName: '',
      clinicType: 'private_clinic',
      registrationLicenseNumber: '',
      establishmentDate: '',
      specialties: [],
      fullName: '',
      phoneNumber: '',
      whatsappNumber: '',
      email: '',
      idNumber: '',
      dateOfBirth: '',
      yearsOfExperience: undefined,
      price: 0,
      isCashPaymentDone: false,
      notes: '',
    },
  })

  const currentStep = WIZARD_STEPS[activeStep]
  const hasMapPin = mapLatitude != null && mapLongitude != null
  const documentsReady = useMemo(
    () => REQUIRED_ACTIVATION_DOCUMENTS.every((field) => documents[field] != null),
    [documents],
  )

  const clinicName = form.watch('clinicName')
  const specialties = form.watch('specialties')
  const fullName = form.watch('fullName')
  const phoneNumber = form.watch('phoneNumber')

  const completionChecks = useMemo(
    () => [
      { label: 'Clinic profile', done: Boolean(clinicName && specialties?.length) },
      { label: 'Admin details', done: Boolean(fullName && phoneNumber) },
      { label: 'Legal documents', done: documentsReady },
      { label: 'Map location', done: hasMapPin },
    ],
    [clinicName, specialties, fullName, phoneNumber, documentsReady, hasMapPin],
  )

  const resetAll = () => {
    form.reset()
    setDocuments({ ...EMPTY_DOCUMENTS })
    setMapLatitude(null)
    setMapLongitude(null)
    setMapAddress('')
    setServiceRadiusKm(DEFAULT_SERVICE_RADIUS_KM)
    setActiveStep(0)
    setSubmitError(null)
  }

  const validateCurrentStep = async () => {
    const stepId = currentStep.id
    if (stepId === 'legal') return documentsReady
    if (stepId === 'location') return hasMapPin
    if (stepId === 'review') {
      return (await form.trigger()) && hasMapPin && documentsReady
    }
    const fields = stepFieldMap[stepId as keyof typeof stepFieldMap]
    if (!fields) return true
    return form.trigger([...fields])
  }

  const goNext = async () => {
    const ok = await validateCurrentStep()
    if (!ok) return
    setSubmitError(null)
    setActiveStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1))
  }

  const goBack = () => {
    setSubmitError(null)
    setActiveStep((prev) => Math.max(prev - 1, 0))
  }

  const goToStep = async (index: number) => {
    if (index < activeStep) {
      setActiveStep(index)
      return
    }
    for (let i = activeStep; i < index; i += 1) {
      const step = WIZARD_STEPS[i]
      if (step.id === 'legal' && !documentsReady) return
      if (step.id === 'location' && !hasMapPin) return
      const fields = stepFieldMap[step.id as keyof typeof stepFieldMap]
      if (fields) {
        const ok = await form.trigger([...fields])
        if (!ok) return
      }
    }
    setActiveStep(index)
  }

  const submit = async () => {
    if (!token || !hasMapPin || !documentsReady) return
    const data = form.getValues()
    setSubmitError(null)
    setSubmitting(true)

    try {
      const payload = {
        ...data,
        email: data.email?.trim() || undefined,
        establishmentDate: data.establishmentDate?.trim() || undefined,
        yearsOfExperience: data.yearsOfExperience ?? undefined,
        latitude: mapLatitude!,
        longitude: mapLongitude!,
        address: mapAddress.trim() || undefined,
        serviceRadiusKm,
      }

      const res = await provisionActivationCode(token, payload, documents)
      onGenerated({ code: res.code, expiresAt: res.expiresAt })
      notify.success(res.message || 'Activation code generated successfully.')
      resetAll()
    } catch (err) {
      setSubmitError(normalizeError(err, 'Could not generate activation code.'))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    form,
    activeStep,
    currentStep,
    submitting,
    submitError,
    mapLatitude,
    mapLongitude,
    mapAddress,
    serviceRadiusKm,
    documents,
    hasMapPin,
    documentsReady,
    completionChecks,
    setMapLatitude,
    setMapLongitude,
    setMapAddress,
    setServiceRadiusKm,
    setDocuments,
    goNext,
    goBack,
    goToStep,
    submit,
  }
}
