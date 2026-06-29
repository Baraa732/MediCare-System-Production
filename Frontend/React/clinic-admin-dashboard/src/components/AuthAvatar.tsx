import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchAvatarBlobUrl } from "@/lib/api/users";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

type AuthAvatarProps = {
  userId?: string;
  avatarUrl?: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export function AuthAvatar({
  userId,
  avatarUrl,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
}: AuthAvatarProps) {
  const token = useAuthStore((s) => s.accessToken);
  const [src, setSrc] = useState<string | null>(null);
  const cacheKey = avatarUrl ?? userId ?? "";

  useEffect(() => {
    if (!userId || !token) {
      setSrc(null);
      return;
    }

    let cancelled = false;
    void fetchAvatarBlobUrl(userId, token, cacheKey).then((url) => {
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, token, cacheKey, avatarUrl]);

  return (
    <Avatar className={cn("rounded-sm", className)}>
      {src && <AvatarImage src={src} className={cn("rounded-sm object-cover", imageClassName)} />}
      <AvatarFallback className={cn("rounded-sm font-semibold bg-[#0066ff] text-white", fallbackClassName)}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}
