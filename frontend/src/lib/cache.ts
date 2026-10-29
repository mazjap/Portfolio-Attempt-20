// A small shared cache for the list and nav endpoints (detail pages use useResource instead).
//
// - Successful responses are kept in localStorage for TTL_MS, under a versioned key, and checked with a
//   validator when read back, so old or malformed entries are ignored rather than trusted.
// - Failures are never cached.
// - Identical requests in flight share one fetch (the sidebar and the console both want the nav).
// - Every localStorage access is guarded: it throws in some private modes and when storage is full.

export const TTL_MS = 5 * 60 * 1000;
const PREFIX = 'cache:v1:';
const LEGACY_KEYS = ['projects', 'posts', 'projects-nav', 'posts-nav', 'console-nav-cache'];

interface Entry {
  data: unknown;
  ts: number;
}

export interface CachedValue<T> {
  data: T;
  fresh: boolean;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Entries written by earlier versions of the site, which weren't validated.
try {
  for (const key of LEGACY_KEYS) storage()?.removeItem(key);
} catch {
  // Storage unavailable; nothing to clean up.
}

export function readCache<T>(key: string, isValid: (value: unknown) => value is T, now = Date.now()): CachedValue<T> | null {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry;
    if (typeof entry?.ts !== 'number' || !isValid(entry.data)) return null;
    return { data: entry.data, fresh: now - entry.ts < TTL_MS };
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() } satisfies Entry));
  } catch {
    // Quota exceeded or storage unavailable: the cache is an optimization, so carry on without it.
  }
}

export function clearCache(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // Storage unavailable.
  }
}

const inFlight = new Map<string, Promise<unknown>>();

/** Runs `load` for `key`, sharing the request with any caller already waiting on the same key. A success is cached. */
export function fetchShared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const request = load()
    .then(data => {
      writeCache(key, data);
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Validator for API lists: an array whose items all have string `id` and `title`. */
export function isListOfItems<T extends { id: string; title: string }>(value: unknown): value is T[] {
  return (
    Array.isArray(value) &&
    value.every(item => typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.title === 'string')
  );
}
