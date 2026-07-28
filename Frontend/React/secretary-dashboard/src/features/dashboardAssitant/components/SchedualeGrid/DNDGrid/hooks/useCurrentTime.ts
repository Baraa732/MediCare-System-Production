import { useMemo } from "react";

export function useCurrentTime() {
  return useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);
}