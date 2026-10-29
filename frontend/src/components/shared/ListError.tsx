import type { ReactNode } from 'react';

interface Props {
  onRetry: () => void;
  /** The decorative crash report. */
  children: ReactNode;
}

/** A list that failed to load: the joke crash report, plus a plain explanation and a way to retry. */
export default function ListError({ onRetry, children }: Props) {
  return (
    <div className="space-y-4" role="alert">
      {children}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="text-xcode-text-light dark:text-xcode-text">
          The server couldn’t be reached, or had a problem. It usually works on a second try.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-md border border-xcode-border-light dark:border-xcode-border font-mono text-xs text-xcode-text-light dark:text-xcode-text hover:border-xcode-accent hover:text-xcode-accent transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
