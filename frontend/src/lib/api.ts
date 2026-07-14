import type { ProjectPreview, ProjectNav, ProjectDetail, PostPreview, PostNav, PostDetail, AppPrivacyPolicy, AppSupport } from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  projects: {
    list: () => get<ProjectPreview[]>('/api/projects'),
    nav: () => get<ProjectNav[]>('/api/projects/nav'),
    get: (id: string) => get<ProjectDetail>(`/api/projects/${id}`),
  },
  posts: {
    list: () => get<PostPreview[]>('/api/posts'),
    nav: () => get<PostNav[]>('/api/posts/nav'),
    get: (id: string) => get<PostDetail>(`/api/posts/${id}`),
  },
  apps: {
    privacyPolicy: (id: string) => get<AppPrivacyPolicy>(`/api/apps/${id}/privacy-policy`),
    support: (id: string) => get<AppSupport>(`/api/apps/${id}/support`),
  },
};
