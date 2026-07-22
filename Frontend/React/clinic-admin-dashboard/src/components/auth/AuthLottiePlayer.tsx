import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { AUTH_LOTTIE_SRC } from "./authLottie";

export function AuthLottiePlayer() {
  return (
    <DotLottieReact
      src={AUTH_LOTTIE_SRC}
      loop
      autoplay
      renderConfig={{ autoResize: true }}
      className="h-full w-full"
    />
  );
}
