import type { ProjectPreview, ProjectNav, ProjectDetail, PostPreview, PostNav, PostDetail, AppPrivacyPolicy, AppSupport } from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** A non-OK response. The message keeps the `"<status> <statusText>"` form older callers check. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`${status} ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.json() as Promise<T>;
}

const segment = encodeURIComponent;

export const api = {
  projects: {
    list: (signal?: AbortSignal) => get<ProjectPreview[]>('/api/projects', signal),
    nav: (signal?: AbortSignal) => get<ProjectNav[]>('/api/projects/nav', signal),
    get: (id: string, signal?: AbortSignal) => get<ProjectDetail>(`/api/projects/${segment(id)}`, signal),
  },
  posts: {
    list: (signal?: AbortSignal) => get<PostPreview[]>('/api/posts', signal),
    nav: (signal?: AbortSignal) => get<PostNav[]>('/api/posts/nav', signal),
    get: (id: string, signal?: AbortSignal) => get<PostDetail>(`/api/posts/${segment(id)}`, signal),
  },
  apps: {
    privacyPolicy: (id: string, signal?: AbortSignal) => get<AppPrivacyPolicy>(`/api/apps/${segment(id)}/privacy-policy`, signal),
    support: (id: string, signal?: AbortSignal) => get<AppSupport>(`/api/apps/${segment(id)}/support`, signal),
  },
};
