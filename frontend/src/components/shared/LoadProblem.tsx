import { Link } from 'react-router-dom';

interface NotFoundProps {
  /** What was missing, like "project". */
  what: string;
  id?: string;
  backTo: string;
  backLabel: string;
}

/** Shown in place of a detail page whose item doesn't exist, styled like a compiler error. */
export function NotFoundMessage({ what, id, backTo, backLabel }: NotFoundProps) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 font-mono text-sm space-y-3" role="alert">
      <p>
        <span className="text-xcode-red font-semibold">error:</span>{' '}
        <span className="text-xcode-text-light dark:text-xcode-text">
          cannot find {what} {id ? <>'<span className="text-xcode-pink">{id}</span>' </> : ''}in scope
        </span>
      </p>
      <p className="text-xcode-muted">It may have been renamed or removed.</p>
      <Link to={backTo} className="inline-block text-xcode-accent hover:underline">
        ← {backLabel}
      </Link>
    </div>
  );
}

interface LoadErrorProps {
  what: string;
  onRetry: () => void;
}

/** Shown when loading failed for a reason other than "not found" (server or network error). */
export function LoadErrorMessage({ what, onRetry }: LoadErrorProps) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 font-mono text-sm space-y-3" role="alert">
      <p>
        <span className="text-xcode-red font-semibold">error:</span>{' '}
        <span className="text-xcode-text-light dark:text-xcode-text">couldn't load this {what}</span>
      </p>
      <p className="text-xcode-muted">The server or your connection had a problem. It usually works on a second try.</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1.5 rounded-md border border-xcode-border-light dark:border-xcode-border text-xcode-text-light dark:text-xcode-text hover:border-xcode-accent hover:text-xcode-accent transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
