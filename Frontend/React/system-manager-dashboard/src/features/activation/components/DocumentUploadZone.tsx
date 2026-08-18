import { useRef, useState } from 'react'
import { Box, Button, Chip, Typography } from '@mui/material'
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react'

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
        p: 1.75,
        borderRadius: '14px',
        border: '1px dashed',
        borderColor: dragOver ? 'rgba(34, 211, 238, 0.65)' : 'rgba(125, 211, 252, 0.22)',
        bgcolor: dragOver ? 'rgba(34, 211, 238, 0.1)' : 'rgba(7, 17, 31, 0.45)',
        boxShadow: dragOver ? '0 0 0 3px rgba(34, 211, 238, 0.12)' : 'none',
        transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
        height: '100%',
        minHeight: 148,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--ac-text)' }}>
            {label}
            {required && (
              <Typography component="span" sx={{ color: '#22d3ee', ml: 0.5 }}>
                *
              </Typography>
            )}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--ac-muted)', display: 'block', mt: 0.35, lineHeight: 1.4 }}>
            {helper}
          </Typography>
        </Box>
        {value && (
          <Button
            size="small"
            onClick={() => onChange(null)}
            startIcon={<X size={12} />}
            sx={{
              color: '#94a3b8',
              textTransform: 'none',
              fontWeight: 650,
              minWidth: 0,
              '&:hover': { color: '#fda4af', bgcolor: 'rgba(251, 113, 133, 0.08)' },
            }}
          >
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
              sx={{
                width: 56,
                height: 56,
                objectFit: 'cover',
                borderRadius: '10px',
                border: '1px solid rgba(125, 211, 252, 0.22)',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(34, 211, 238, 0.12)',
                color: '#67e8f9',
                border: '1px solid rgba(34, 211, 238, 0.22)',
              }}
            >
              <FileText size={20} />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ color: 'var(--ac-text)', fontWeight: 600 }}>
              {value.name}
            </Typography>
            <Chip
              size="small"
              icon={isImage ? <ImageIcon size={12} /> : <FileText size={12} />}
              label={`${(value.size / 1024).toFixed(0)} KB`}
              sx={{
                mt: 0.6,
                height: 24,
                bgcolor: 'rgba(34, 211, 238, 0.12)',
                color: '#a5f3fc',
                border: '1px solid rgba(34, 211, 238, 0.22)',
                '& .MuiChip-icon': { color: '#67e8f9' },
              }}
            />
          </Box>
        </Box>
      ) : (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Upload size={14} />}
          onClick={() => inputRef.current?.click()}
          sx={{
            borderStyle: 'dashed',
            borderColor: 'rgba(34, 211, 238, 0.35)',
            color: '#a5f3fc',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            px: 1.5,
            '&:hover': {
              borderColor: '#22d3ee',
              bgcolor: 'rgba(34, 211, 238, 0.08)',
              borderStyle: 'dashed',
            },
          }}
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
