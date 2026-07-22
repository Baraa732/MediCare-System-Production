import { useRef, useState } from 'react'
import { Box, Button, Chip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react'
import { ACTIVATION_ACCENT, ACTIVATION_SECONDARY } from '../activationConstants'

type DocumentUploadZoneProps = {
  label: string
  helper: string
  required?: boolean
  value: File | null
  onChange: (file: File | null) => void
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export default function DocumentUploadZone({
  label,
  helper,
  required = false,
  value,
  onChange,
}: DocumentUploadZoneProps) {
  const theme = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const isImage = value?.type.startsWith('image/')
  const previewUrl = value && isImage ? URL.createObjectURL(value) : null

  const pickFile = (file: File | null) => {
    if (!file) {
      onChange(null)
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) return
    if (file.size > 10 * 1024 * 1024) return
    onChange(file)
  }

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        pickFile(e.dataTransfer.files?.[0] ?? null)
      }}
      sx={{
        p: 1.5,
        borderRadius: '5px',
        border: '1px dashed',
        borderColor: dragOver ? ACTIVATION_SECONDARY : alpha(theme.palette.divider, 0.95),
        bgcolor: dragOver ? alpha(ACTIVATION_SECONDARY, 0.06) : alpha(theme.palette.background.elevated, 0.45),
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
            {required && (
              <Typography component="span" sx={{ color: ACTIVATION_ACCENT, ml: 0.5 }}>
                *
              </Typography>
            )}
          </Typography>
          <Typography variant="caption2" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {helper}
          </Typography>
        </Box>
        {value && (
          <Button size="small" color="inherit" onClick={() => onChange(null)} startIcon={<X size={12} />}>
            Remove
          </Button>
        )}
      </Box>

      {value ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt={value.name}
              onLoad={() => URL.revokeObjectURL(previewUrl)}
              sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '4px', border: `1px solid ${theme.palette.divider}` }}
            />
          ) : (
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '4px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(ACTIVATION_SECONDARY, 0.1),
                color: ACTIVATION_SECONDARY,
              }}
            >
              <FileText size={20} />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>{value.name}</Typography>
            <Chip
              size="small"
              icon={isImage ? <ImageIcon size={12} /> : <FileText size={12} />}
              label={`${(value.size / 1024).toFixed(0)} KB`}
              sx={{ mt: 0.5, height: 22 }}
            />
          </Box>
        </Box>
      ) : (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Upload size={14} />}
          onClick={() => inputRef.current?.click()}
          sx={{ borderStyle: 'dashed' }}
        >
          Upload image or PDF
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
    </Box>
  )
}
