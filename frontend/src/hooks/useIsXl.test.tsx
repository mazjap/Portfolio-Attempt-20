import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIsXl } from './useIsXl';

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('useIsXl', () => {
  it('follows the 1280 px media query as the window is resized', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return matches && query === '(min-width: 1280px)';
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })) as unknown as typeof window.matchMedia;

    const { result, unmount } = renderHook(() => useIsXl());
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listeners.forEach(fn => fn());
    });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
