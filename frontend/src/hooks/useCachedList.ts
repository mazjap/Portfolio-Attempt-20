import { useCallback, useEffect, useState } from 'react';
import { fetchShared, onPageReturn, readCache } from '../lib/cache';

/** On returning to the page, a list fetched longer ago than this is fetched again. */
export const REVALIDATE_ON_RETURN_MS = 10 * 1000;

export interface CachedListState<T> {
  /** The latest data: fetched this visit, or cached (possibly stale while it revalidates). */
  data: T | null;
  loading: boolean;
  /** Loading failed and there's nothing cached to show. */
  error: boolean;
  retry: () => void;
}

interface Settled<T> {
  key: string;
  attempt: number;
  data?: T;
  failed?: true;
}

/**
 * Loads a list endpoint through the shared cache (src/lib/cache.ts). A fresh cache entry renders
 * immediately with no request; a stale one renders while a new copy loads; nothing cached means a
 * loading state. `retry()` always refetches. With `enabled: false` it only reads the cache (the
 * console uses this until it's opened).
 *
 * When the visitor returns to the tab (focus or visibilitychange), it refetches in the background,
 * even if the entry is still fresh, unless it was fetched in the last REVALIDATE_ON_RETURN_MS. The
 * current data stays on screen meanwhile, and a failed refetch keeps it rather than showing an error.
 *
 * `load` and `isValid` must be stable (module-level functions).
 */
export function useCachedList<T>(
  key: string,
  load: () => Promise<T>,
  isValid: (value: unknown) => value is T,
  { enabled = true }: { enabled?: boolean } = {},
): CachedListState<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  const current = settled?.key === key && settled.attempt === attempt ? settled : null;
  // Read on every render: it's a small entry, and it's what lets a fresh cache skip the loading state.
  // Also read after a failure, so a failed refetch falls back to what's cached instead of an error.
  const cached = current?.data !== undefined ? null : readCache(key, isValid);
  const needsFetch = enabled && !current && (attempt > 0 || !cached?.fresh);

  useEffect(() => {
    if (!needsFetch) return;
    let ignore = false;
    fetchShared(key, () => load()).then(
      data => {
        if (!ignore) setSettled({ key, attempt, data });
      },
      () => {
        if (!ignore) setSettled({ key, attempt, failed: true });
      },
    );
    return () => {
      ignore = true;
    };
  }, [key, attempt, needsFetch, load]);

  useEffect(() => {
    if (!enabled) return;
    return onPageReturn(() => {
      const entry = readCache(key, isValid);
      if (entry && entry.ageMs < REVALIDATE_ON_RETURN_MS) return;
      setAttempt(a => a + 1);
    });
  }, [key, isValid, enabled]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  const data = current?.data ?? cached?.data ?? null;
  const failed = Boolean(current?.failed);
  return { data, loading: data === null && !failed, error: data === null && failed, retry };
}
