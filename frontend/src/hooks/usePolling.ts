import { useEffect, useRef } from 'react';

export interface UsePollingOptions {
  /** Run once immediately when `enabled` becomes true (e.g. modal open). */
  immediate?: boolean;
}

/**
 * Poll `callback` on a fixed interval. Uses a ref so the latest callback
 * is always invoked without resetting the timer on every render.
 */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  enabled = true,
  options: UsePollingOptions = {}
): void {
  const { immediate = false } = options;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    if (immediate) {
      callbackRef.current();
    }
    const id = window.setInterval(() => callbackRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled, immediate]);
}
