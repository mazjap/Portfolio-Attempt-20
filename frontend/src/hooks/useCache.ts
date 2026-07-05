const TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export function useCache<T>(key: string) {
  function get(): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.ts > TTL) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  function set(data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch {
      // Storage quota exceeded — silently skip
    }
  }

  function clear(): void {
    localStorage.removeItem(key);
  }

  return { get, set, clear };
}
