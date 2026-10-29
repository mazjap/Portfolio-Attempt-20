import { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { usePostNav } from '../../hooks/usePosts';
import { useResource } from '../../hooks/useResource';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import Sidebar from '../layout/Sidebar';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import ScrollMinimap from '../shared/ScrollMinimap';
import ResponsiveImage from '../shared/ResponsiveImage';
import { LoadErrorMessage, NotFoundMessage } from '../shared/LoadProblem';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const articleRef = useRef<HTMLElement>(null);
  const { state, retry } = useResource(id, api.posts.get);
  const post = state.status === 'ok' ? state.data : null;
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  useDocumentTitle(
    post ? post.title : state.status === 'not-found' ? 'Post Not Found' : state.status === 'error' ? 'Error' : null,
    post?.excerpt,
  );
  const { nav, loading: navLoading } = usePostNav();

  const date = post
    ? new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="flex flex-1">
      <Sidebar type="posts" items={nav ?? []} loading={navLoading} />

      <main className="flex-1 min-w-0">
        {state.status === 'loading' && (
          <div className="max-w-prose mx-auto px-6 py-10 animate-pulse space-y-4">
            <div className="h-8 w-3/4 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
            <div className="h-4 w-40 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="h-4 rounded bg-xcode-surface-light dark:bg-xcode-surface" style={{ width: `${60 + n * 6}%` }} />
            ))}
          </div>
        )}

        {state.status === 'not-found' && (
          <NotFoundMessage what="post" id={id} backTo="/blog" backLabel="All posts" />
        )}

        {state.status === 'error' && <LoadErrorMessage what="post" onRetry={retry} />}

        {post && (
          <article ref={articleRef} className="max-w-prose mx-auto px-6 py-10 animate-fade-in">
            {/* The sidebar is hidden below lg, so small screens get a way back. */}
            <Link to="/blog" className="lg:hidden inline-block mb-4 font-mono text-xs text-xcode-accent hover:underline">
              ← All posts
            </Link>
            {post.heroImage && (
              <ResponsiveImage
                src={post.heroImage}
                sizes="(min-width: 768px) 680px, 100vw"
                loading="eager"
                alt=""
                className="w-full rounded-xl object-cover mb-8 max-h-72"
              />
            )}

            {post.series && (
              <div className="mb-5 px-4 py-2 rounded-lg bg-xcode-accent/10 border border-xcode-accent/30 flex items-center gap-2">
                <span className="text-xcode-accent text-sm font-mono">
                  {post.series}
                </span>
              </div>
            )}

            <h1 className="text-3xl font-bold text-xcode-text-light dark:text-xcode-text leading-tight mb-3">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-xcode-muted mb-6">
              <time dateTime={post.createdAt}>{date}</time>
              <span>·</span>
              <span>{post.readingTime} min read</span>
              {tags.map(tag => (
                <Link
                  key={tag}
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 rounded bg-xcode-surface-light dark:bg-xcode-surface border border-xcode-border-light dark:border-xcode-border hover:border-xcode-accent/50 hover:text-xcode-accent transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <hr className="border-xcode-border-light dark:border-xcode-border mb-8" />

            <MarkdownRenderer content={post.content} />
          </article>
        )}
      </main>

      <ScrollMinimap contentRef={articleRef} contentKey={post ? post.id : null} />
    </div>
  );
}
