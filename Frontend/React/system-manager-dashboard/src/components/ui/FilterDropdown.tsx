import { FormControl, MenuItem, Select } from '@mui/material'

export default function FilterDropdown({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: string[]
  onChange?: (v: string) => void
  label?: string
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={value}
        displayEmpty
        onChange={(e) => onChange?.(String(e.target.value))}
        sx={{
          height: 32,
          fontSize: 12,
          color: 'text.primary',
          bgcolor: 'background.paper',
          borderRadius: '10px',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
        }}
        inputProps={{ 'aria-label': label ?? 'Filter' }}
      >
        {options.map((opt) => (
          <MenuItem key={opt} value={opt} sx={{ fontSize: 12 }}>
            {opt}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
