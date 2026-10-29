import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';
import { RouteErrorFallback } from './ErrorFallback';

function Boom({ error }: { error: Error | null }): React.ReactNode {
  if (error) throw error;
  return <p>content</p>;
}

const renderBoundary = (resetKey: string, error: Error | null) => (
  <ErrorBoundary resetKey={resetKey} fallback={props => <RouteErrorFallback {...props} />}>
    <Boom error={error} />
  </ErrorBoundary>
);

describe('ErrorBoundary', () => {
  it('shows a fallback instead of blanking, and clears it when the route changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(renderBoundary('/projects/bad', new Error('kaboom')));
    expect(screen.getByRole('alert').textContent).toContain('Thread 1: Fatal error');
    expect(screen.getByText('kaboom')).toBeTruthy(); // in the collapsed details
    rerender(renderBoundary('/projects', null));
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('Try Again re-renders the children', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let error: Error | null = new Error('once');
    function Flaky() {
      if (error) throw error;
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary fallback={props => <RouteErrorFallback {...props} />}>
        <Flaky />
      </ErrorBoundary>,
    );
    error = null;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  it('asks for a reload when a page chunk failed to load after a deploy', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(renderBoundary('/x', new TypeError('Failed to fetch dynamically imported module: /assets/Page-abc.js')));
    expect(screen.getByRole('alert').textContent).toContain('out of date');
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reload Page' })).toBeTruthy();
  });
});
