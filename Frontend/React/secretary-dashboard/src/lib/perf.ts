export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

export function scheduleOnVisible(callback: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;

  const run = () => {
    if (document.visibilityState === "visible") callback();
  };

  document.addEventListener("visibilitychange", run);
  return () => document.removeEventListener("visibilitychange", run);
}
