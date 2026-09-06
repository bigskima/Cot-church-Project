type Entry<T> = { value: T; storedAt: number };
export type CacheSnapshot<T> = { value: T | undefined; stale: boolean; storedAt?: number };

const memory = new Map<string, Entry<unknown>>();

export function cacheSnapshot<T>(key: string, maxAgeMs = 300_000): CacheSnapshot<T> {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (!hit) return { value: undefined, stale: false };
  return {
    value: hit.value,
    stale: Date.now() - hit.storedAt >= maxAgeMs,
    storedAt: hit.storedAt,
  };
}

export function cached<T>(key: string, maxAgeMs = 300_000) {
  const snapshot = cacheSnapshot<T>(key, maxAgeMs);
  return snapshot.stale ? undefined : snapshot.value;
}

export function remember<T>(key: string, value: T) {
  memory.set(key, { value, storedAt: Date.now() });
}

export function invalidate(prefix: string) {
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
}
