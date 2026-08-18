import { Suspense } from 'react'
import { lazyWithReload } from '../../../lib/staleChunk'
import {
  Alert,
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { Controller, type UseFormReturn } from 'react-hook-form'
import type { ActivationProvisioningForm } from '../activationSchema'
import {
  CLINIC_TYPES,
  DOCUMENT_FIELD_META,
  MEDICAL_SPECIALTY_OPTIONS,
  REQUIRED_ACTIVATION_DOCUMENTS,
  type ActivationDocumentField,
} from '../activationConstants'
import {
  consoleAlertSx,
  consoleAutocompleteSx,
  consoleCheckboxSx,
  consoleFieldSx,
  consoleFormLabelSx,
  consoleMenuProps,
  consoleReviewCardSx,
} from '../console/formFieldSx'
import DocumentUploadZone from './DocumentUploadZone'

const ClinicLocationPicker = lazyWithReload(() => import('../ClinicLocationPicker'))

type ProvisionStepPanelsProps = {
  stepId: string
  form: UseFormReturn<ActivationProvisioningForm>
  documents: Record<ActivationDocumentField, File | null>
  setDocuments: React.Dispatch<React.SetStateAction<Record<ActivationDocumentField, File | null>>>
  documentsReady: boolean
  hasMapPin: boolean
  mapLatitude: number | null
  mapLongitude: number | null
  mapAddress: string
  serviceRadiusKm: number
  setMapLatitude: (v: number | null) => void
  setMapLongitude: (v: number | null) => void
  setMapAddress: (v: string) => void
  setServiceRadiusKm: (v: number) => void
}

export default function ProvisionStepPanels(props: ProvisionStepPanelsProps) {
  const {
    stepId,
    form,
    documents,
    setDocuments,
    documentsReady,
    hasMapPin,
    mapLatitude,
    mapLongitude,
    mapAddress,
    serviceRadiusKm,
    setMapLatitude,
    setMapLongitude,
    setMapAddress,
    setServiceRadiusKm,
  } = props

  const { control, formState: { errors }, getValues } = form

  switch (stepId) {
    case 'clinic':
      return (
        <Grid container spacing={2.25}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller name="clinicName" control={control} render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                size="small"
                label="Official clinic name"
                error={!!errors.clinicName}
                helperText={errors.clinicName?.message}
                sx={consoleFieldSx}
              />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller name="clinicType" control={control} render={({ field }) => (
              <FormControl fullWidth size="small" sx={consoleFieldSx}>
                <InputLabel>Clinic type</InputLabel>
                <Select {...field} label="Clinic type" MenuProps={consoleMenuProps}>
                  {CLINIC_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller name="registrationLicenseNumber" control={control} render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                size="small"
                label="Registration / license number"
                error={!!errors.registrationLicenseNumber}
                helperText={errors.registrationLicenseNumber?.message}
                sx={consoleFieldSx}
              />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller name="establishmentDate" control={control} render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                size="small"
                type="date"
                label="Establishment date (optional)"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={consoleFieldSx}
              />
            )} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Controller name="specialties" control={control} render={({ field }) => (
              <Autocomplete
                multiple
                options={MEDICAL_SPECIALTY_OPTIONS.map((item) => item.value)}
                getOptionLabel={(value) => MEDICAL_SPECIALTY_OPTIONS.find((item) => item.value === value)?.label ?? value}
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 0.75,
                      borderRadius: '12px',
                      bgcolor: 'var(--ac-panel)',
                      color: 'var(--ac-text)',
                      border: '1px solid var(--ac-line)',
                      backgroundImage: 'none',
                      boxShadow: 'var(--ac-shadow)',
                      '& .MuiAutocomplete-option': {
                        fontSize: 13.5,
                        borderRadius: '8px',
                        mx: 0.5,
                        '&[aria-selected="true"]': { bgcolor: 'var(--ac-fill-strong)' },
                        '&.Mui-focused': { bgcolor: 'var(--ac-fill)' },
                      },
                    },
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Specialties"
                    error={!!errors.specialties}
                    helperText={errors.specialties?.message}
                    sx={consoleAutocompleteSx}
                  />
                )}
              />
            )} />
          </Grid>
        </Grid>
      )

    case 'admin':
      return (
        <Grid container spacing={2.25}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller name="fullName" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Full name" error={!!errors.fullName} helperText={errors.fullName?.message} sx={consoleFieldSx} />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller name="idNumber" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="ID number" error={!!errors.idNumber} helperText={errors.idNumber?.message} sx={consoleFieldSx} />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller name="phoneNumber" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Phone number" error={!!errors.phoneNumber} helperText={errors.phoneNumber?.message} sx={consoleFieldSx} />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller name="whatsappNumber" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="WhatsApp number" error={!!errors.whatsappNumber} helperText={errors.whatsappNumber?.message} sx={consoleFieldSx} />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller name="email" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Email (optional)" error={!!errors.email} helperText={errors.email?.message} sx={consoleFieldSx} />
            )} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller name="dateOfBirth" control={control} render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                size="small"
                type="date"
                label="Date of birth"
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.dateOfBirth}
                helperText={errors.dateOfBirth?.message}
                sx={consoleFieldSx}
              />
            )} />
          </Grid>
        </Grid>
      )

    case 'legal':
      return (
        <Grid container spacing={1.75}>
          {(['nationalId', 'clinicLicense', 'governmentId', 'commercialRegistry'] as ActivationDocumentField[]).map((field) => (
            <Grid key={field} size={{ xs: 12, md: 6 }}>
              <DocumentUploadZone
                label={DOCUMENT_FIELD_META[field].label}
                helper={DOCUMENT_FIELD_META[field].helper}
                required={DOCUMENT_FIELD_META[field].required}
                value={documents[field]}
                onChange={(file) => setDocuments((prev) => ({ ...prev, [field]: file }))}
              />
            </Grid>
          ))}
          {!documentsReady && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="warning" sx={consoleAlertSx}>
                National ID, clinic license, and government ID are required.
              </Alert>
            </Grid>
          )}
        </Grid>
      )

    case 'doctor':
      return (
        <Grid container spacing={2.25}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Controller name="yearsOfExperience" control={control} render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                size="small"
                type="number"
                label="Years of experience (optional)"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                sx={consoleFieldSx}
              />
            )} />
          </Grid>
          {(['medicalDegree', 'specializationCertificate', 'boardCertifications'] as ActivationDocumentField[]).map((field) => (
            <Grid key={field} size={{ xs: 12, md: 6 }}>
              <DocumentUploadZone
                label={DOCUMENT_FIELD_META[field].label}
                helper={DOCUMENT_FIELD_META[field].helper}
                required={false}
                value={documents[field]}
                onChange={(file) => setDocuments((prev) => ({ ...prev, [field]: file }))}
              />
            </Grid>
          ))}
        </Grid>
      )

    case 'location':
      return (
        <Suspense fallback={<Box className="clinic-map-skeleton" sx={{ borderRadius: '12px', minHeight: 280 }} />}>
          <ClinicLocationPicker
            latitude={mapLatitude}
            longitude={mapLongitude}
            address={mapAddress}
            serviceRadiusKm={serviceRadiusKm}
            embedded
            onLocationChange={({ latitude, longitude }) => {
              setMapLatitude(latitude)
              setMapLongitude(longitude)
            }}
            onAddressChange={setMapAddress}
            onRadiusChange={setServiceRadiusKm}
          />
        </Suspense>
      )

    case 'review': {
      const data = getValues()
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
            <ReviewCard title="Clinic" lines={[
              data.clinicName || '—',
              CLINIC_TYPES.find((item) => item.value === data.clinicType)?.label ?? data.clinicType,
              `License: ${data.registrationLicenseNumber || '—'}`,
              `Specialties: ${data.specialties.join(', ') || '—'}`,
            ]} />
            <ReviewCard title="Admin" lines={[
              data.fullName || '—',
              data.phoneNumber || '—',
              `WhatsApp: ${data.whatsappNumber || '—'}`,
              data.email || 'No email',
            ]} />
            <ReviewCard title="Location" lines={[
              mapAddress || 'Address pending',
              hasMapPin ? `${mapLatitude}, ${mapLongitude}` : 'Pin not set',
              `Radius: ${serviceRadiusKm} km`,
            ]} />
            <ReviewCard title="Documents" lines={[
              `${Object.values(documents).filter(Boolean).length} files attached`,
              ...REQUIRED_ACTIVATION_DOCUMENTS.map((field) => `${DOCUMENT_FIELD_META[field].label}: ${documents[field] ? '✓' : 'missing'}`),
            ]} />
          </Box>

          <Grid container spacing={2.25}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller name="price" control={control} render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  type="number"
                  label="Price"
                  onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                  sx={consoleFieldSx}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Controller name="notes" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" label="Internal notes (optional)" multiline minRows={2} sx={consoleFieldSx} />
              )} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Controller name="isCashPaymentDone" control={control} render={({ field }) => (
                <FormControlLabel
                  sx={consoleFormLabelSx}
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      sx={consoleCheckboxSx}
                    />
                  }
                  label="Cash payment received"
                />
              )} />
            </Grid>
          </Grid>

          {!hasMapPin && (
            <Alert severity="warning" sx={consoleAlertSx}>
              Clinic location is required before generating activation code.
            </Alert>
          )}
        </Box>
      )
    }

    default:
      return null
  }
}

function ReviewCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Box sx={consoleReviewCardSx}>
      <Typography
        variant="caption"
        sx={{ color: 'var(--ac-glow)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {title}
      </Typography>
      {lines.map((line) => (
        <Typography key={`${title}-${line}`} variant="body2" sx={{ mt: 0.75, color: 'var(--ac-muted)', fontWeight: 500 }}>
          {line}
        </Typography>
      ))}
    </Box>
  )
}
