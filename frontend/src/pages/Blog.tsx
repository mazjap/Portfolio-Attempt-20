import { usePosts } from '../hooks/usePosts';
import PostList from '../components/blog/PostList';
import CrashReport from '../components/shared/CrashReport';

export default function Blog() {
  const { posts, loading, error } = usePosts();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-xcode-text-light dark:text-xcode-text mb-1">Blog</h1>
        <p className="text-xcode-muted text-sm">Notes from the build log.</p>
      </div>

      {error ? (
        <CrashReport context="posts" />
      ) : (
        <PostList posts={posts ?? []} loading={loading} />
      )}
    </div>
  );
}
