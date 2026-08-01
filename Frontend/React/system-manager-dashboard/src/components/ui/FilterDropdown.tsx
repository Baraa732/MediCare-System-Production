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
          color: '#e8eaf0',
          bgcolor: 'rgba(15,17,23,0.55)',
          borderRadius: '10px',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2a3147' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#06b6d460' },
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
