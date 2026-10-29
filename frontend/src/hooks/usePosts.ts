import { api } from '../lib/api';
import { isListOfItems } from '../lib/cache';
import { useCachedList } from './useCachedList';
import type { PostPreview, PostNav } from '../types';

const loadPosts = () => api.posts.list();
const loadPostNav = () => api.posts.nav();

export function usePosts() {
  const { data, loading, error, retry } = useCachedList('posts', loadPosts, isListOfItems<PostPreview>);
  return { posts: data, loading, error, retry };
}

export function usePostNav({ enabled = true }: { enabled?: boolean } = {}) {
  const { data, loading } = useCachedList('posts-nav', loadPostNav, isListOfItems<PostNav>, { enabled });
  return { nav: data, loading };
}
