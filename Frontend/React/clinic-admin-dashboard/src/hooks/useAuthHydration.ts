import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

/** Waits for zustand persist to finish loading sessionStorage before routing. */
export function useAuthHydration() {
  const storeHydrated = useAuthStore((s) => s._hasHydrated);
  const [ready, setReady] = useState(
    () => useAuthStore.persist.hasHydrated() || storeHydrated,
  );

  useEffect(() => {
    const markReady = () => {
      useAuthStore.setState({ _hasHydrated: true });
      setReady(true);
    };

    if (
      useAuthStore.persist.hasHydrated() ||
      useAuthStore.getState()._hasHydrated
    ) {
      markReady();
      return;
    }

    const unsub = useAuthStore.persist.onFinishHydration(() => {
      markReady();
    });

    const timeout = window.setTimeout(markReady, 800);

    return () => {
      unsub();
      window.clearTimeout(timeout);
    };
  }, []);

  return ready || storeHydrated;
}
