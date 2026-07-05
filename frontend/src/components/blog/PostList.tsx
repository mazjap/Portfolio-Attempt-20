import { useSearchParams } from 'react-router-dom';
import PostCard from './PostCard';
import type { PostPreview } from '../../types';

interface Props {
  posts: PostPreview[];
  loading?: boolean;
}

function SkeletonPost() {
  return (
    <div className="border-b border-xcode-border-light dark:border-xcode-border py-6 animate-pulse space-y-2">
      <div className="h-3 w-40 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
      <div className="h-6 w-3/4 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
      <div className="h-4 w-full rounded bg-xcode-surface-light dark:bg-xcode-surface" />
      <div className="h-4 w-5/6 rounded bg-xcode-surface-light dark:bg-xcode-surface" />
    </div>
  );
}

export default function PostList({ posts, loading }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get('tag');

  function setTag(tag: string | null) {
    if (tag) {
      setSearchParams({ tag }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();
  const filtered = activeTag ? posts.filter(p => p.tags.includes(activeTag)) : posts;

  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(n => <SkeletonPost key={n} />)}
      </div>
    );
  }

  return (
    <div>
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-xcode-border-light dark:border-xcode-border">
          <button
            onClick={() => setTag(null)}
            className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
              activeTag === null
                ? 'border-xcode-accent text-xcode-accent bg-xcode-accent/10'
                : 'border-xcode-border-light dark:border-xcode-border text-xcode-muted hover:border-xcode-accent/50 hover:text-xcode-accent/70'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTag(tag === activeTag ? null : tag)}
              className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
                activeTag === tag
                  ? 'border-xcode-accent text-xcode-accent bg-xcode-accent/10'
                  : 'border-xcode-border-light dark:border-xcode-border text-xcode-muted hover:border-xcode-accent/50 hover:text-xcode-accent/70'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xcode-muted font-mono text-sm">No posts tagged "{activeTag}".</p>
      ) : (
        filtered.map(post => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
