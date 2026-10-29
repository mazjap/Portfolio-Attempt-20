import { describe, expect, it, vi } from 'vitest';
import { fetchShared, isListOfItems, readCache, writeCache, TTL_MS } from './cache';
import { formatCalendarDate } from './dates';
import { mediaSrcSet } from './media';
import { getCategoryExtension } from './category';

describe('cache', () => {
  it('shares one request between callers and caches only successes', async () => {
    const load = vi.fn(async () => [{ id: 'a', title: 'A' }]);
    const [first, second] = await Promise.all([fetchShared('k', load), fetchShared('k', load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(readCache('k', isListOfItems)?.data).toEqual([{ id: 'a', title: 'A' }]);

    await expect(fetchShared('bad', async () => { throw new Error('500'); })).rejects.toThrow();
    expect(readCache('bad', isListOfItems)).toBeNull();
  });

  it('ignores malformed and old-format entries, and reports staleness', () => {
    writeCache('list', [{ id: 1 }]);
    expect(readCache('list', isListOfItems)).toBeNull();
    localStorage.setItem('cache:v1:garbage', '{not json');
    expect(readCache('garbage', isListOfItems)).toBeNull();
    writeCache('ok', []);
    expect(readCache('ok', isListOfItems)?.fresh).toBe(true);
    expect(readCache('ok', isListOfItems, Date.now() + TTL_MS + 1)?.fresh).toBe(false);
  });
});

describe('helpers', () => {
  it('formats calendar dates without shifting them a day (TZ=America/Denver)', () => {
    expect(formatCalendarDate('2025-01-01')).toBe('January 1, 2025');
    expect(formatCalendarDate('not a date')).toBe('not a date');
  });

  it('builds srcsets only for uploaded WebP images', () => {
    expect(mediaSrcSet('/media/projects/a/1. Launch.webp')).toBe(
      '/media/projects/a/1.%20Launch.w640.webp 640w, /media/projects/a/1.%20Launch.w1280.webp 1280w, /media/projects/a/1.%20Launch.webp 2560w',
    );
    expect(mediaSrcSet('/media/projects/a/hero.jpg')).toBeUndefined();
    expect(mediaSrcSet('https://example.com/x.webp')).toBeUndefined();
    expect(mediaSrcSet('/media/projects/a/x.w640.webp')).toBeUndefined();
  });

  it('maps categories to file extensions', () => {
    expect(getCategoryExtension('iOS App')).toBe('swift');
    expect(getCategoryExtension('Web')).toBe('ts');
    expect(getCategoryExtension(null)).toBeNull();
  });
});
