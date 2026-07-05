import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useCache } from './useCache';
import type { PostPreview, PostNav } from '../types';

export function usePosts() {
  const [posts, setPosts] = useState<PostPreview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useCache<PostPreview[]>('posts');

  useEffect(() => {
    const cached = cache.get();
    if (cached) {
      setPosts(cached);
      setLoading(false);
      return;
    }
    api.posts.list()
      .then(data => {
        setPosts(data);
        cache.set(data);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return { posts, loading, error };
}

export function usePostNav() {
  const [nav, setNav] = useState<PostNav[] | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useCache<PostNav[]>('posts-nav');

  useEffect(() => {
    const cached = cache.get();
    if (cached) {
      setNav(cached);
      setLoading(false);
      return;
    }
    api.posts.nav()
      .then(data => {
        setNav(data);
        cache.set(data);
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoading(false));
  }, []);

  return { nav, loading };
}
