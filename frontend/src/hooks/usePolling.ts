import { useEffect, useRef } from 'react';

/**
 * Poll `callback` on a fixed interval. Uses a ref so the latest callback
 * is always invoked without resetting the timer on every render.
 */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  enabled = true
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => callbackRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
