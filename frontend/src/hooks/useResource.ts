import { useCallback, useEffect, useState } from 'react';
import { isNotFound } from '../lib/api';

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };

interface Settled<T> {
  key: string;
  attempt: number;
  state: ResourceState<T>;
}

const LOADING = { status: 'loading' } as const;

/**
 * Loads the resource named by `key` (like a project ID) and returns its state for *that* key only.
 *
 * - When `key` changes, the state is `loading` straight away, so the previous item never shows under
 *   the new URL.
 * - A superseded request is aborted, and its result is ignored even if it arrives anyway, so a slow
 *   response can't overwrite a newer one or trigger a stale 404.
 * - `retry()` loads the same key again.
 *
 * `load` must be stable (a module-level function like `api.projects.get`), or it reloads every render.
 */
export function useResource<T>(
  key: string | undefined,
  load: (key: string, signal: AbortSignal) => Promise<T>,
): { state: ResourceState<T>; retry: () => void } {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === undefined) return;
    const controller = new AbortController();
    load(key, controller.signal).then(
      data => {
        if (!controller.signal.aborted) setSettled({ key, attempt, state: { status: 'ok', data } });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({ key, attempt, state: isNotFound(err) ? { status: 'not-found' } : { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [key, attempt, load]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  const current = settled && settled.key === key && settled.attempt === attempt ? settled.state : LOADING;
  return { state: current, retry };
}
