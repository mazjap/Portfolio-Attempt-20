import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useResource } from './useResource';
import { ApiError } from '../lib/api';

/** A load function whose results the test resolves by hand, per key. */
function controllableLoad() {
  const pending = new Map<string, { resolve: (v: string) => void; reject: (e: unknown) => void }>();
  const load = vi.fn((key: string) => new Promise<string>((resolve, reject) => pending.set(key, { resolve, reject })));
  return { load, pending };
}

function Show({ id, load }: { id: string; load: (key: string, signal: AbortSignal) => Promise<string> }) {
  const { state, retry } = useResource(id, load);
  return (
    <div>
      <p data-testid="state">{state.status === 'ok' ? `ok:${state.data}` : state.status}</p>
      <button onClick={retry}>retry</button>
    </div>
  );
}

describe('useResource', () => {
  it('ignores a slow response for an ID the user already left (A → slow B → A)', async () => {
    const { load, pending } = controllableLoad();
    const { rerender } = render(<Show id="a" load={load} />);
    await act(async () => pending.get('a')!.resolve('Alpha'));
    expect(screen.getByTestId('state').textContent).toBe('ok:Alpha');

    rerender(<Show id="b" load={load} />);
    expect(screen.getByTestId('state').textContent).toBe('loading'); // old item cleared immediately
    const slowB = pending.get('b')!;
    rerender(<Show id="a" load={load} />);
    await act(async () => pending.get('a')!.resolve('Alpha again'));
    await act(async () => slowB.resolve('Beta (late)'));
    expect(screen.getByTestId('state').textContent).toBe('ok:Alpha again');
  });

  it('reports not-found for a 404, error otherwise, and retries', async () => {
    const { load, pending } = controllableLoad();
    const { rerender } = render(<Show id="missing" load={load} />);
    await act(async () => pending.get('missing')!.reject(new ApiError(404, 'Not Found')));
    expect(screen.getByTestId('state').textContent).toBe('not-found');

    rerender(<Show id="flaky" load={load} />);
    await act(async () => pending.get('flaky')!.reject(new ApiError(500, 'Server Error')));
    expect(screen.getByTestId('state').textContent).toBe('error');

    await act(async () => screen.getByText('retry').click());
    expect(screen.getByTestId('state').textContent).toBe('loading');
    await act(async () => pending.get('flaky')!.resolve('Recovered'));
    expect(screen.getByTestId('state').textContent).toBe('ok:Recovered');
  });
});
