/**
 * Shared in-browser TTL cache for dashboard metadata and analytics.
 * Enables stale-while-revalidate polling — tabs stay responsive while data refreshes.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export const DASHBOARD_CACHE_TTL = {
  bootstrap: 120_000,
  users: 120_000,
  apis: 120_000,
  analytics: 30_000,
} as const;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export async function getOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  const data = await fetcher();
  setCached(key, data, ttlMs);
  return data;
}

/**
 * Return cached data immediately when available; refresh in the background.
 * Used for polling so charts do not flash loading states every interval.
 */
export async function getStaleWhileRevalidate<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onUpdate?: (data: T) => void,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    void fetcher()
      .then((fresh) => {
        setCached(key, fresh, ttlMs);
        onUpdate?.(fresh);
      })
      .catch(() => {});
    return cached;
  }
  const data = await fetcher();
  setCached(key, data, ttlMs);
  return data;
}

export function cacheKey(parts: Record<string, string | number | undefined | null>): string {
  return Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
}
