/**
 * Two-layer cache: in-memory (fast, session-scoped) backed by AsyncStorage
 * (survives app restarts and works offline).
 *
 * Usage:
 *   const cached = await getCache<T>('my-key');
 *   if (cached) { use(cached.data); if (cached.stale) backgroundRefresh(); }
 *   await setCache('my-key', freshData);
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from './app-config';

const pfx = APP_CONFIG.storageKeyPrefix;

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number; // Unix ms
}

// In-memory layer — cleared on app restart, avoids AsyncStorage overhead for
// repeated reads within the same session (e.g. tab switches).
const mem = new Map<string, CacheEntry<unknown>>();

function storageKey(key: string): string {
  return `${pfx}:cache:${key}`;
}

/**
 * Read a cached value.
 * Returns `null` if nothing is cached.
 * Returns `{ data, stale: true }` if the entry is older than `ttlMs`.
 */
export async function getCache<T>(
  key: string,
  ttlMs = DEFAULT_TTL_MS
): Promise<{ data: T; stale: boolean } | null> {
  // 1. In-memory hit
  const entry = mem.get(key) as CacheEntry<T> | undefined;
  if (entry) {
    return { data: entry.data, stale: Date.now() - entry.fetchedAt > ttlMs };
  }

  // 2. AsyncStorage hit (populates memory layer for future reads)
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;
    const stored = JSON.parse(raw) as CacheEntry<T>;
    mem.set(key, stored as CacheEntry<unknown>);
    return { data: stored.data, stale: Date.now() - stored.fetchedAt > ttlMs };
  } catch {
    return null;
  }
}

/** Write a value to both layers. */
export async function setCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
  mem.set(key, entry as CacheEntry<unknown>);
  try {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Best-effort — in-memory layer still works
  }
}

/** Force-expire a key so the next read is treated as stale. */
export function invalidateCache(key: string): void {
  mem.delete(key);
  AsyncStorage.removeItem(storageKey(key)).catch(() => {});
}
