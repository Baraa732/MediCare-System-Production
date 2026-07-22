import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  IconButton,
  InputAdornment,
  CircularProgress,
  alpha,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import { LOGIN_ERROR_FALLBACK } from '../../../api/errors'
import { notify } from '../../../lib/toast'

const schema = z.object({
  username: z.string().min(3, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    fontSize: 14,
    bgcolor: '#f8fafc',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    '&:hover': { bgcolor: '#fff' },
    '&.Mui-focused': {
      bgcolor: '#fff',
      boxShadow: `0 0 0 3px ${alpha('#3b82f6', 0.15)}`,
    },
  },
}

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    const result = await login(data.username, data.password)
    setLoading(false)
    if (result.success) {
      notify.success('Signed in securely')
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
      navigate(from || '/', { replace: true })
    } else {
      setError(result.error || LOGIN_ERROR_FALLBACK)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      {error && (
        <Alert data-login-field severity="error" variant="outlined" sx={{ fontSize: 13, borderRadius: 2.5 }}>
          {error}
        </Alert>
      )}

      <Box data-login-field>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.75, display: 'block', fontWeight: 500 }}>
          Username or email
        </Typography>
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              disabled={loading}
              autoComplete="username"
              placeholder="Username or email"
              error={!!errors.username}
              helperText={errors.username?.message}
              sx={fieldSx}
            />
          )}
        />
      </Box>

      <Box data-login-field>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Password
          </Typography>
          <Typography
            variant="caption"
            component={Link}
            to="/forgot-password"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Forgot password?
          </Typography>
        </Box>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              disabled={loading}
              autoComplete="current-password"
              placeholder="Password"
              error={!!errors.password}
              helperText={errors.password?.message}
              type={showPassword ? 'text' : 'password'}
              sx={fieldSx}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        />
      </Box>

      <Button
        data-login-submit
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        startIcon={loading ? undefined : <LogIn size={18} />}
        sx={{
          mt: 0.5,
          height: 46,
          fontSize: 15,
          fontWeight: 600,
          borderRadius: 2.5,
          textTransform: 'none',
          boxShadow: '0 8px 20px -6px rgba(37, 99, 235, 0.55)',
        }}
      >
        {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
      </Button>
    </Box>
  )
}
