import { lazy, Suspense, useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { reloadOnceOnStaleChunk } from '../../../lib/staleChunk'

const playerImport = import('./AuthLottiePlayer').catch((error: unknown) => {
  reloadOnceOnStaleChunk(error)
  return Promise.reject(error)
})

const AuthLottiePlayer = lazy(() =>
  playerImport.then((m) => ({ default: m.AuthLottiePlayer })),
)

type AuthLottieHeroProps = {
  size?: number
}

function Placeholder({ size }: { size: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.08) 100%)',
      }}
    />
  )
}

export default function AuthLottieHero({ size = 280 }: AuthLottieHeroProps) {
  const [showPlayer, setShowPlayer] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShowPlayer(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!showPlayer) return <Placeholder size={size} />

  return (
    <Box sx={{ width: size, height: size, mx: 'auto' }} aria-hidden>
      <Suspense fallback={<Placeholder size={size} />}>
        <AuthLottiePlayer />
      </Suspense>
    </Box>
  )
}
