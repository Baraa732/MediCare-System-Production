import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { SM_LOGIN_LOTTIE_SRC } from './authLottie'

export function AuthLottiePlayer() {
  return (
    <DotLottieReact
      src={SM_LOGIN_LOTTIE_SRC}
      loop
      autoplay
      renderConfig={{ autoResize: true }}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
