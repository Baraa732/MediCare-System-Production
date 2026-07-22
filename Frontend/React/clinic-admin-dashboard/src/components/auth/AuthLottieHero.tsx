import { lazy, Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Start downloading the player chunk as soon as this module loads.
const playerImport = import("./AuthLottiePlayer");

const AuthLottiePlayer = lazy(() =>
  playerImport.then((m) => ({ default: m.AuthLottiePlayer })),
);

type AuthLottieHeroProps = {
  className?: string;
};

function LottiePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-[#ecf3ff] to-[#d6e6ff]",
        className,
      )}
      aria-hidden
    />
  );
}

export function AuthLottieHero({ className }: AuthLottieHeroProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  // Let the sign-in form paint first, then mount the player (next frame).
  useEffect(() => {
    const id = requestAnimationFrame(() => setShowPlayer(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!showPlayer) {
    return <LottiePlaceholder className={className} />;
  }

  return (
    <div className={cn("relative", className)} aria-hidden>
      <Suspense fallback={<LottiePlaceholder className="absolute inset-0" />}>
        <AuthLottiePlayer />
      </Suspense>
    </div>
  );
}
