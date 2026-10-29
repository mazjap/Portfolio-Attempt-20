// A lazy page's chunk can disappear when a new build is deployed while the tab is open. React caches
// the failed import, so only a reload fixes it.
function isChunkLoadError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically/i.test(
    `${error.name} ${error.message}`,
  );
}

const buttonCls =
  'px-3 py-1.5 rounded-md border border-xcode-border-light dark:border-xcode-border text-xcode-text-light dark:text-xcode-text hover:border-xcode-accent hover:text-xcode-accent transition-colors';

interface Props {
  error: Error;
  reset: () => void;
}

/** The raw message, collapsed: in production builds React's messages are long minified-error links. */
function ErrorDetails({ error }: { error: Error }) {
  return (
    <details className="text-xs text-xcode-muted">
      <summary className="cursor-pointer font-mono select-none">Details</summary>
      <pre className="mt-2 whitespace-pre-wrap break-words font-mono">{error.message}</pre>
    </details>
  );
}

/** Fallback for a page that crashed while rendering. The navbar and console stay usable. */
export function RouteErrorFallback({ error, reset }: Props) {
  const outdated = isChunkLoadError(error);
  return (
    <div className="flex-1 flex items-start justify-center px-4 py-16" role="alert">
      <div className="w-full max-w-xl rounded-xl border border-xcode-border-light dark:border-xcode-border overflow-hidden">
        <div className="bg-xcode-red/10 border-b border-xcode-red/30 px-4 py-2 font-mono text-sm text-xcode-red">
          {outdated ? 'warning: this page is out of date' : 'Thread 1: Fatal error'}
        </div>
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-xcode-text-light dark:text-xcode-text">
            {outdated
              ? 'The site was updated since you opened it, so part of this page couldn’t load. Reloading gets the latest version.'
              : 'This page crashed while it was drawing. The rest of the site still works.'}
          </p>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {!outdated && (
              <button type="button" onClick={reset} className={buttonCls}>
                Try Again
              </button>
            )}
            <button type="button" onClick={() => window.location.reload()} className={buttonCls}>
              Reload Page
            </button>
            {/* A plain link, not <Link>: it also works if the router itself is what broke. */}
            <a href="/" className={buttonCls}>
              Home
            </a>
          </div>
          {!outdated && <ErrorDetails error={error} />}
        </div>
      </div>
    </div>
  );
}

/** Last-resort fallback for errors outside the routes (navbar, console, router). */
export function AppErrorFallback({ error }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" role="alert">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-mono text-sm text-xcode-red">Thread 1: Fatal error</p>
        <p className="text-sm text-xcode-text-light dark:text-xcode-text">Something broke while loading the site.</p>
        <div className="flex justify-center gap-2 font-mono text-xs">
          <button type="button" onClick={() => window.location.reload()} className={buttonCls}>
            Reload Page
          </button>
          <a href="/" className={buttonCls}>
            Home
          </a>
        </div>
        <div className="text-left">
          <ErrorDetails error={error} />
        </div>
      </div>
    </div>
  );
}
