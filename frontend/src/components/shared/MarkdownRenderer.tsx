import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import ResponsiveImage from './ResponsiveImage';

interface Props {
  content: string;
  className?: string;
}

// Set by `pre`, so `code` knows it's a block even without a `language-` class (an unlabelled fence).
const InPre = createContext(false);

/** The path for a link to a page of this site, or null for anything else (other sites, files, mailto:). */
function sitePagePath(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // Real files (the feed, media, the API) aren't router pages.
  if (/^\/(api|media)\//.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}

function MarkdownLink({ href = '', children }: { href?: string; children?: ReactNode }) {
  const cls = 'text-xcode-accent hover:underline';
  // In-page anchors stay put, site pages use the router (no reload), other sites open in a new tab.
  if (href.startsWith('#')) return <a href={href} className={cls}>{children}</a>;
  const path = sitePagePath(href);
  if (path) return <Link to={path} className={cls}>{children}</Link>;
  if (!/^https?:/i.test(href)) return <a href={href} className={cls}>{children}</a>;
  return (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4', cls: string): Components['h1'] {
  return function Heading({ id, children }) {
    return (
      <Tag id={id} className={`group scroll-mt-16 ${cls}`}>
        {children}
        {id && (
          <a
            href={`#${id}`}
            className="ml-2 text-xcode-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 no-underline font-mono text-[0.8em]"
            aria-label="Link to this section"
          >
            #
          </a>
        )}
      </Tag>
    );
  };
}

function Code({ className: cls, children }: { className?: string; children?: ReactNode }) {
  const isBlock = useContext(InPre);
  if (isBlock) {
    return <code className={`${cls ?? ''} block w-full`}>{children}</code>;
  }
  return (
    <code className="font-mono text-sm bg-xcode-surface-light dark:bg-xcode-surface px-1.5 py-0.5 rounded text-xcode-pink">
      {children}
    </code>
  );
}

const components: Components = {
  h1: heading('h1', 'text-2xl font-semibold text-xcode-text-light dark:text-xcode-text mt-8 mb-4'),
  h2: heading('h2', 'text-xl font-semibold text-xcode-text-light dark:text-xcode-text mt-6 mb-3'),
  h3: heading('h3', 'text-lg font-medium text-xcode-text-light dark:text-xcode-text mt-5 mb-2'),
  h4: heading('h4', 'text-base font-medium text-xcode-text-light dark:text-xcode-text mt-4 mb-2'),
  p: ({ children }) => (
    <p className="text-[15px] leading-7 text-xcode-text-light/90 dark:text-xcode-text/90 mb-4">{children}</p>
  ),
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 mb-4 space-y-1">{children}</ul>
  ),
  // Keep `start`, so a list that begins at 3 still does.
  ol: ({ children, start }) => (
    <ol start={start} className="list-decimal list-outside pl-5 mb-4 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[15px] leading-7 text-xcode-text-light/90 dark:text-xcode-text/90">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-xcode-accent pl-4 italic text-xcode-muted my-4">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => <Code className={className}>{children}</Code>,
  pre: ({ children }) => (
    <pre className="w-full mb-4 overflow-x-auto rounded-lg p-4 bg-xcode-surface-light dark:bg-xcode-surface">
      <InPre.Provider value={true}>{children}</InPre.Provider>
    </pre>
  ),
  // Wide tables scroll inside their own box instead of widening the page.
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-xcode-border-light dark:border-xcode-border">
      <table className="min-w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={style} className="px-3 py-2 text-left font-semibold bg-xcode-surface-light dark:bg-xcode-surface text-xcode-text-light dark:text-xcode-text border-b border-xcode-border-light dark:border-xcode-border">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top text-xcode-text-light/90 dark:text-xcode-text/90 border-b border-xcode-border-light dark:border-xcode-border">
      {children}
    </td>
  ),
  hr: () => <hr className="border-xcode-border-light dark:border-xcode-border my-6" />,
  img: ({ src, alt }) =>
    typeof src === 'string' ? (
      <ResponsiveImage src={src} alt={alt ?? ''} sizes="(min-width: 768px) 680px, 100vw" className="rounded-lg w-full my-4 object-cover" />
    ) : null,
  strong: ({ children }) => (
    <strong className="font-semibold text-xcode-text-light dark:text-xcode-text">{children}</strong>
  ),
};

export default function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={`prose-xcode min-w-0 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug, rehypeHighlight]} components={components}>
        {typeof content === 'string' ? content : ''}
      </ReactMarkdown>
    </div>
  );
}
