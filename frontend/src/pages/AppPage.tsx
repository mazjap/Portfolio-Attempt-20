import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AppPrivacyPolicy, AppSupport } from '../types';
import MarkdownRenderer from '../components/shared/MarkdownRenderer';
import NotFound from './NotFound';

type PageType = 'privacy-policy' | 'support';

type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };

function isPageType(s: string | undefined): s is PageType {
  return s === 'privacy-policy' || s === 'support';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function toAsyncState<T>(result: PromiseSettledResult<T>): AsyncState<T> {
  if (result.status === 'fulfilled') return { status: 'ok', data: result.value };
  const msg: string = (result.reason as Error)?.message ?? '';
  return msg.startsWith('404') ? { status: 'not-found' } : { status: 'error' };
}

function ContactSection({ contactText, contactUrl }: { contactText?: string; contactUrl?: string }) {
  return (
    <div className="mt-12 pt-6 border-t border-xcode-border-light dark:border-xcode-border">
      <h2 className="text-lg font-semibold text-xcode-text-light dark:text-xcode-text mb-2">Contact</h2>
      <p className="text-[15px] text-xcode-text-light/80 dark:text-xcode-text/80 mb-3">
        Questions or concerns? Reach out directly:
      </p>
      <a
        href="mailto:jordan.c4922@gmail.com"
        className="text-xcode-accent hover:underline text-[15px] block"
      >
        jordan.c4922@gmail.com
      </a>
      {contactText && contactUrl && (
        <a
          href={contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xcode-accent hover:underline text-[15px] block mt-1"
        >
          {contactText}
        </a>
      )}
    </div>
  );
}

export default function AppPage() {
  const { appId, pageType } = useParams<{ appId: string; pageType: string }>();

  const [pp, setPp] = useState<AsyncState<AppPrivacyPolicy>>({ status: 'loading' });
  const [sup, setSup] = useState<AsyncState<AppSupport>>({ status: 'loading' });

  useEffect(() => {
    if (!appId) return;
    setPp({ status: 'loading' });
    setSup({ status: 'loading' });

    Promise.allSettled([
      api.apps.privacyPolicy(appId),
      api.apps.support(appId),
    ]).then(([ppResult, supResult]) => {
      setPp(toAsyncState(ppResult));
      setSup(toAsyncState(supResult));
    });
  }, [appId]);

  if (!isPageType(pageType)) return <NotFound />;

  const requested = pageType === 'privacy-policy' ? pp : sup;
  const other = pageType === 'privacy-policy' ? sup : pp;
  const otherType = pageType === 'privacy-policy' ? 'support' : 'privacy-policy';
  const otherLabel = pageType === 'privacy-policy' ? 'Support' : 'Privacy Policy';

  const appName =
    pp.status === 'ok' ? pp.data.appName :
    sup.status === 'ok' ? sup.data.appName :
    appId ?? '';

  const loading = pp.status === 'loading' || sup.status === 'loading';

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  const sidebar = (
    <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col sticky top-12 h-[calc(100vh-3rem)] border-r border-xcode-border-light dark:border-xcode-border overflow-y-auto">
      <div className="px-3 py-2 border-b border-xcode-border-light dark:border-xcode-border">
        <span className="text-[11px] font-mono uppercase tracking-widest text-xcode-muted truncate block">
          {appName}
        </span>
      </div>
      <nav className="flex-1 py-1">
        {loading ? (
          <div className="px-3 py-4 space-y-2">
            {[1, 2].map(n => (
              <div key={n} className="h-4 rounded bg-xcode-surface-light dark:bg-xcode-surface animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {pp.status === 'ok' && (
              <Link
                to={`/apps/${appId}/privacy-policy`}
                className={`flex items-center px-3 py-1.5 text-xs transition-colors border-l-2 ${
                  pageType === 'privacy-policy'
                    ? 'border-xcode-accent bg-xcode-accent/10 text-xcode-text-light dark:text-xcode-text'
                    : 'border-transparent text-xcode-muted hover:text-xcode-text-light dark:hover:text-xcode-text hover:bg-xcode-surface-light dark:hover:bg-xcode-surface/50'
                }`}
              >
                Privacy Policy
              </Link>
            )}
            {sup.status === 'ok' && (
              <Link
                to={`/apps/${appId}/support`}
                className={`flex items-center px-3 py-1.5 text-xs transition-colors border-l-2 ${
                  pageType === 'support'
                    ? 'border-xcode-accent bg-xcode-accent/10 text-xcode-text-light dark:text-xcode-text'
                    : 'border-transparent text-xcode-muted hover:text-xcode-text-light dark:hover:text-xcode-text hover:bg-xcode-surface-light dark:hover:bg-xcode-surface/50'
                }`}
              >
                Support
              </Link>
            )}
          </>
        )}
      </nav>
    </aside>
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10 space-y-4">
          {[80, 50, 65, 45, 70].map((w, i) => (
            <div key={i} className="h-4 rounded bg-xcode-surface-light dark:bg-xcode-surface animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </main>
      </div>
    );
  }

  // ── Error: server error on requested page ────────────────────────────────────

  if (requested.status === 'error') {
    return (
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
          <p className="text-xcode-text-light/70 dark:text-xcode-text/70">
            Something went wrong loading this page. Try again later.
          </p>
        </main>
      </div>
    );
  }

  // ── Error: page not found ────────────────────────────────────────────────────

  if (requested.status === 'not-found') {
    return (
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
          {other.status === 'ok' ? (
            <p className="text-xcode-text-light/70 dark:text-xcode-text/70">
              {appName} doesn't have a {pageType === 'privacy-policy' ? 'privacy policy' : 'support'} page.{' '}
              <Link to={`/apps/${appId}/${otherType}`} className="text-xcode-accent hover:underline">
                View {otherLabel} instead
              </Link>
            </p>
          ) : (
            <p className="text-xcode-text-light/70 dark:text-xcode-text/70">
              We couldn't find anything here.{' '}
              <Link to="/projects" className="text-xcode-accent hover:underline">
                See my projects
              </Link>
            </p>
          )}
        </main>
      </div>
    );
  }

  // ── Privacy Policy ───────────────────────────────────────────────────────────

  if (pageType === 'privacy-policy' && pp.status === 'ok') {
    const page = pp.data;
    return (
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold text-xcode-text-light dark:text-xcode-text mb-2">
              {page.appName} Privacy Policy
            </h1>
            <p className="text-sm text-xcode-muted">Last updated: {formatDate(page.lastUpdated)}</p>
          </header>
          <MarkdownRenderer content={page.content} />
          <ContactSection contactText={page.contactText} contactUrl={page.contactUrl} />
        </main>
      </div>
    );
  }

  // ── Support ──────────────────────────────────────────────────────────────────

  const page = (sup as { status: 'ok'; data: AppSupport }).data;
  return (
    <div className="flex flex-1">
      {sidebar}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-xcode-text-light dark:text-xcode-text mb-2">
            {page.appName} Support v{page.version}
          </h1>
          <p className="text-sm text-xcode-muted">{page.subtitle}</p>
        </header>
        <MarkdownRenderer content={page.content} />
        <ContactSection contactText={page.contactText} contactUrl={page.contactUrl} />
      </main>
    </div>
  );
}
