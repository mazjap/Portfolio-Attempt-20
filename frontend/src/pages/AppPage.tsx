import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatCalendarDate } from '../lib/dates';
import MarkdownRenderer from '../components/shared/MarkdownRenderer';
import { LoadErrorMessage } from '../components/shared/LoadProblem';
import NotFound from './NotFound';

type PageType = 'privacy-policy' | 'support';

function isPageType(s: string | undefined): s is PageType {
  return s === 'privacy-policy' || s === 'support';
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

  // Loaded independently: the requested page shows as soon as it arrives, and the sidebar link to
  // the other page appears whenever that one does.
  const { state: pp, retry: retryPp } = useResource(appId, api.apps.privacyPolicy);
  const { state: sup, retry: retrySup } = useResource(appId, api.apps.support);

  const shownName = pp.status === 'ok' ? pp.data.appName : sup.status === 'ok' ? sup.data.appName : null;
  const shown = pageType === 'privacy-policy' ? pp : sup;
  useDocumentTitle(
    !isPageType(pageType) ? 'Not Found'
      : shown.status === 'ok' && shownName ? `${shownName} ${pageType === 'privacy-policy' ? 'Privacy Policy' : 'Support'}`
      : shown.status === 'loading' ? null
      : 'Page Not Found',
    shownName ? `${pageType === 'support' ? 'Help and contact information' : 'Privacy policy'} for ${shownName}.` : undefined,
  );

  if (!isPageType(pageType)) return <NotFound />;

  const requested = pageType === 'privacy-policy' ? pp : sup;
  const retryRequested = pageType === 'privacy-policy' ? retryPp : retrySup;
  const other = pageType === 'privacy-policy' ? sup : pp;
  const otherType = pageType === 'privacy-policy' ? 'support' : 'privacy-policy';
  const otherLabel = pageType === 'privacy-policy' ? 'Support' : 'Privacy Policy';

  const appName =
    pp.status === 'ok' ? pp.data.appName :
    sup.status === 'ok' ? sup.data.appName :
    appId ?? '';

  const sidebarLoading = pp.status === 'loading' || sup.status === 'loading';
  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-md font-mono text-xs border transition-colors ${
      active
        ? 'border-xcode-accent text-xcode-accent bg-xcode-accent/10'
        : 'border-xcode-border-light dark:border-xcode-border text-xcode-muted hover:text-xcode-accent hover:border-xcode-accent/50'
    }`;

  // The sidebar is hidden below lg, so small screens get the same links as tabs above the content.
  const mobileTabs = (pp.status === 'ok' || sup.status === 'ok') && (
    <nav aria-label={`${appName} pages`} className="lg:hidden flex flex-wrap gap-2 mb-6">
      {pp.status === 'ok' && (
        <Link to={`/apps/${appId}/privacy-policy`} aria-current={pageType === 'privacy-policy' ? 'page' : undefined} className={tabCls(pageType === 'privacy-policy')}>
          Privacy Policy
        </Link>
      )}
      {sup.status === 'ok' && (
        <Link to={`/apps/${appId}/support`} aria-current={pageType === 'support' ? 'page' : undefined} className={tabCls(pageType === 'support')}>
          Support
        </Link>
      )}
    </nav>
  );
  // A missing page's message depends on whether the other page exists, so wait for both then.
  const loading = requested.status === 'loading' || (requested.status === 'not-found' && other.status === 'loading');

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  const sidebar = (
    <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col sticky top-12 h-[calc(100vh-3rem)] border-r border-xcode-border-light dark:border-xcode-border overflow-y-auto">
      <div className="px-3 py-2 border-b border-xcode-border-light dark:border-xcode-border">
        <span className="text-[11px] font-mono uppercase tracking-widest text-xcode-muted truncate block">
          {appName}
        </span>
      </div>
      <nav className="flex-1 py-1">
        {pp.status === 'ok' && (
          <Link
            to={`/apps/${appId}/privacy-policy`}
            aria-current={pageType === 'privacy-policy' ? 'page' : undefined}
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
            aria-current={pageType === 'support' ? 'page' : undefined}
            className={`flex items-center px-3 py-1.5 text-xs transition-colors border-l-2 ${
              pageType === 'support'
                ? 'border-xcode-accent bg-xcode-accent/10 text-xcode-text-light dark:text-xcode-text'
                : 'border-transparent text-xcode-muted hover:text-xcode-text-light dark:hover:text-xcode-text hover:bg-xcode-surface-light dark:hover:bg-xcode-surface/50'
            }`}
          >
            Support
          </Link>
        )}
        {sidebarLoading && (
          <div className="px-3 py-2">
            <div className="h-4 rounded bg-xcode-surface-light dark:bg-xcode-surface animate-pulse" />
          </div>
        )}
      </nav>
    </aside>
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 min-w-0 max-w-3xl mx-auto px-6 py-10 space-y-4">
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
        <main className="flex-1 min-w-0 max-w-3xl mx-auto px-6 py-10">
          {mobileTabs}
          <LoadErrorMessage what="page" onRetry={retryRequested} />
        </main>
      </div>
    );
  }

  // ── Error: page not found ────────────────────────────────────────────────────

  if (requested.status === 'not-found') {
    return (
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 min-w-0 max-w-3xl mx-auto px-6 py-10">
          {mobileTabs}
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
        <main className="flex-1 min-w-0 max-w-3xl mx-auto px-6 py-10">
          {mobileTabs}
          <header className="mb-8">
            <h1 className="text-3xl font-semibold text-xcode-text-light dark:text-xcode-text mb-2">
              {page.appName} Privacy Policy
            </h1>
            <p className="text-sm text-xcode-muted">Last updated: {formatCalendarDate(page.lastUpdated)}</p>
          </header>
          <MarkdownRenderer content={page.content} />
          <ContactSection contactText={page.contactText} contactUrl={page.contactUrl} />
        </main>
      </div>
    );
  }

  // ── Support ──────────────────────────────────────────────────────────────────

  if (sup.status !== 'ok') return <NotFound />;
  const page = sup.data;
  return (
    <div className="flex flex-1">
      {sidebar}
      <main className="flex-1 min-w-0 max-w-3xl mx-auto px-6 py-10">
        {mobileTabs}
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
