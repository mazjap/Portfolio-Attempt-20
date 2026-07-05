import { Link } from 'react-router-dom';
import type { PostPreview } from '../../types';

interface Props {
  post: PostPreview;
}

export default function PostCard({ post }: Props) {
  const date = new Date(post.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <article className="group border-b border-xcode-border-light dark:border-xcode-border py-6 last:border-0">
      <Link to={`/blog/${post.id}`} className="block">
        {post.heroImage && (
          <img
            src={post.heroImage}
            alt={post.title}
            className="w-full h-48 object-cover rounded-lg mb-4 group-hover:opacity-90 transition-opacity"
          />
        )}

        <div className="flex items-center gap-3 text-xs font-mono text-xcode-muted mb-2">
          <span>{date}</span>
          <span>·</span>
          <span>{post.readingTime} min read</span>
          {post.series && (
            <>
              <span>·</span>
              <span className="text-xcode-accent">{post.series}</span>
            </>
          )}
        </div>

        <h2 className="text-lg font-semibold text-xcode-text-light dark:text-xcode-text group-hover:text-xcode-accent transition-colors leading-snug mb-2">
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="text-[14px] text-xcode-muted leading-6 mb-3 line-clamp-2">
            {post.excerpt}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {post.tags.map(tag => (
            <span
              key={tag}
              className="text-[11px] font-mono text-xcode-muted bg-xcode-surface-light dark:bg-xcode-surface border border-xcode-border-light dark:border-xcode-border px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </Link>
    </article>
  );
}
