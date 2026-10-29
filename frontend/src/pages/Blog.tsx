import { usePosts } from '../hooks/usePosts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PostList from '../components/blog/PostList';
import CrashReport from '../components/shared/CrashReport';
import ListError from '../components/shared/ListError';

export default function Blog() {
  const { posts, loading, error, retry } = usePosts();
  useDocumentTitle('Blog', 'Notes from the build log.');

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-xcode-text-light dark:text-xcode-text mb-1">Blog</h1>
        <p className="text-xcode-muted text-sm">
          Notes from the build log.{' '}
          <a href="/feed.xml" className="text-xcode-accent hover:underline">RSS</a>
        </p>
      </div>

      {error ? (
        <ListError onRetry={retry}>
          <CrashReport context="posts" />
        </ListError>
      ) : (
        <PostList posts={posts ?? []} loading={loading} />
      )}
    </div>
  );
}
