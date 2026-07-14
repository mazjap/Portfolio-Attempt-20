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
}

export interface AppSupport {
  id: string;
  appName: string;
  version: string;
  subtitle: string;
  content: string;
  contactUrl?: string;
  contactText?: string;
}
