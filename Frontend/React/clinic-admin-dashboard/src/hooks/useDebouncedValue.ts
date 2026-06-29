import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isPhoneLikeQuery(query: string): boolean {
  const digits = digitsOnly(query);
  return digits.length >= 3 && digits.length / Math.max(query.trim().length, 1) > 0.5;
}

export function normalizePhoneQuery(query: string): string {
  return digitsOnly(query);
}
