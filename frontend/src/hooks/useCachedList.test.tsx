import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useCachedList, REVALIDATE_ON_RETURN_MS } from './useCachedList';
import { isListOfItems, readCache } from '../lib/cache';

type Item = { id: string; title: string };
const isItems = isListOfItems<Item>;

/** A load function whose calls the test settles by hand, in order. */
function controllableLoad() {
  const calls: { resolve: (v: Item[]) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(() => new Promise<Item[]>((resolve, reject) => calls.push({ resolve, reject })));
  return { load, calls };
}

function Show({ load, enabled = true }: { load: () => Promise<Item[]>; enabled?: boolean }) {
  const { data, loading, error } = useCachedList('list', load, isItems, { enabled });
  const text = error ? 'error' : loading ? 'loading' : (data ?? []).map(item => item.title).join(',');
  return <p data-testid="state">{text}</p>;
}

/** A cache entry written `ageMs` ago (still fresh: well under the 5-minute TTL). */
function seedCache(items: Item[], ageMs: number) {
  localStorage.setItem('cache:v1:list', JSON.stringify({ data: items, ts: Date.now() - ageMs }));
}

const state = () => screen.getByTestId('state').textContent;
const returnToTab = () => act(async () => void window.dispatchEvent(new Event('focus')));
const tabBecomesVisible = () => act(async () => void document.dispatchEvent(new Event('visibilitychange')));

describe('useCachedList revalidation on returning to the page', () => {
  it('refetches a fresh entry on focus and shows the new content', async () => {
    seedCache([{ id: 'a', title: 'Old' }], 60_000);
    const { load, calls } = controllableLoad();
    render(<Show load={load} />);
    expect(state()).toBe('Old');
    expect(load).not.toHaveBeenCalled(); // fresh: no request on mount

    await returnToTab();
    expect(load).toHaveBeenCalledTimes(1);
    expect(state()).toBe('Old'); // still shown while it reloads
    await act(async () => calls[0].resolve([{ id: 'a', title: 'Old' }, { id: 'b', title: 'Published' }]));
    expect(state()).toBe('Old,Published');
    expect(readCache('list', isItems)?.data).toHaveLength(2);
  });

  it('also refetches when the tab becomes visible, sharing one request with focus', async () => {
    seedCache([{ id: 'a', title: 'Old' }], 60_000);
    const { load, calls } = controllableLoad();
    render(<Show load={load} />);
    await tabBecomesVisible();
    await returnToTab(); // switching tabs usually fires both
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => calls[0].resolve([{ id: 'a', title: 'New' }]));
    expect(state()).toBe('New');
  });

  it('skips the refetch when the list was fetched moments ago', async () => {
    seedCache([{ id: 'a', title: 'Just loaded' }], REVALIDATE_ON_RETURN_MS / 2);
    const { load } = controllableLoad();
    render(<Show load={load} />);
    await returnToTab();
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps showing the current list when the background refetch fails', async () => {
    seedCache([{ id: 'a', title: 'Old' }], 60_000);
    const { load, calls } = controllableLoad();
    render(<Show load={load} />);
    await returnToTab();
    await act(async () => calls[0].reject(new Error('offline')));
    expect(state()).toBe('Old');
  });

  it('does nothing while disabled', async () => {
    seedCache([{ id: 'a', title: 'Old' }], 60_000);
    const { load } = controllableLoad();
    render(<Show load={load} enabled={false} />);
    await returnToTab();
    expect(load).not.toHaveBeenCalled();
  });

  it('stops listening after unmounting', async () => {
    seedCache([{ id: 'a', title: 'Old' }], 60_000);
    const { load } = controllableLoad();
    const { unmount } = render(<Show load={load} />);
    unmount();
    await returnToTab();
    expect(load).not.toHaveBeenCalled();
  });
});
