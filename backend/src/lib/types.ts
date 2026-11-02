export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  caption?: string;
}

export interface ProjectPreview {
  id: string;
  title: string;
  tagline: string;
  heroImage: string;
  category?: string;
  status: 'active' | 'in-progress' | 'archived';
  featured: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type ProjectDetail = ProjectPreview & {
  description: string;
  media: MediaItem[];
  techStack: string[];
  links: Record<string, string>;
};

export interface ProjectNav {
  id: string;
  title: string;
  status: 'active' | 'in-progress' | 'archived';
  featured?: boolean;
}

export interface PostPreview {
  id: string;
  title: string;
  excerpt: string;
  heroImage?: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  readingTime: number;
  series?: string;
}

export type PostDetail = PostPreview & {
  content: string;
};

export interface PostNav {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  series?: string;
}

export interface AppPrivacyPolicy {
  id: string;
  appName: string;
  lastUpdated: string;
  content: string;
  contactUrl?: string;
  contactText?: string;
  /** Set by the server on every save. Pages saved before October 31, 2026 don't have one until they're next saved. */
  updatedAt?: string;
}

export interface AppSupport {
  id: string;
  appName: string;
  version: string;
  subtitle: string;
  content: string;
  contactUrl?: string;
  contactText?: string;
  /** Set by the server on every save. Pages saved before October 31, 2026 don't have one until they're next saved. */
  updatedAt?: string;
}

export type AppPageType = 'privacy-policy' | 'support';

/** An entry of `GET /api/apps`. */
export interface AppSummary {
  id: string;
  /** From the privacy policy, else the support page (the ID if neither has one). */
  appName: string;
  /** The pages that exist, in this order: `privacy-policy`, `support`. */
  pages: AppPageType[];
}
