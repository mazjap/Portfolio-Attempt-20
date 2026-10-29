// Public files generated from the content: sitemap.xml, feed.xml (RSS), and a "share page" per item.
//
// A share page is the deployed index.html with that item's title, description, and Open Graph tags
// filled in, written to `<publicDir>/_meta/<path>.html`. The .htaccess template serves it for the
// matching URL, so link previews (iMessage, Slack, search results) get real metadata without running
// JavaScript, and the page then boots the SPA as usual. Pages are rebuilt from the *current* index.html
// on every content change and at startup, so they pick up new frontend builds.
import { mkdir, readdir, readFile, unlink } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { appsDir, fileExists, mediaDir, postsDir, projectsDir, publicDir, readJSON, siteUrl, writeFileAtomic } from './files.js';
import { derivativePath } from './images.js';
import { withLock } from './lock.js';
import { logger } from './logger.js';
import { isValidSlug } from './paths.js';
import type { AppPrivacyPolicy, AppSupport, PostPreview, ProjectPreview } from './types.js';

export const SHARE_DIR = '_meta';
const SITE_NAME = 'Jordan Christensen';
const SITE_DESCRIPTION = 'iOS developer, tinkerer, and open-source advocate. Projects, a build-log blog, and app support pages.';
const FEED_SIZE = 20;

interface Page {
  path: string;
  title: string;
  description: string;
  image?: string;
  type: 'website' | 'article';
  lastModified?: string;
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function summarize(text: string | undefined, fallback: string): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 200 ? `${clean.slice(0, 197).trimEnd()}…` : clean;
}

function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${siteUrl}${encodeURI(path)}`;
}

/** A preview image: the 1280 px size when it exists (smaller to fetch), else the image itself. */
async function previewImage(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('/media/') && url.endsWith('.webp')) {
    const smaller = derivativePath(url, 1280);
    if (await fileExists(join(mediaDir, smaller.slice('/media/'.length)))) return absoluteUrl(smaller);
  }
  return absoluteUrl(url);
}

async function readList<T>(path: string): Promise<T[]> {
  try {
    const list = await readJSON<unknown>(path);
    return Array.isArray(list) ? (list as T[]) : [];
  } catch {
    return [];
  }
}

async function appPages(): Promise<Page[]> {
  const pages: Page[] = [];
  let entries: string[] = [];
  try {
    entries = await readdir(appsDir);
  } catch {
    return pages;
  }
  for (const id of entries.filter(isValidSlug).sort()) {
    const privacy = await readJSON<AppPrivacyPolicy>(join(appsDir, id, 'privacy-policy.json')).catch(() => null);
    if (privacy?.appName) {
      pages.push({
        path: `/apps/${id}/privacy-policy`,
        title: `${privacy.appName} Privacy Policy`,
        description: `How ${privacy.appName} handles your data.`,
        type: 'website',
        lastModified: privacy.lastUpdated,
      });
    }
    const support = await readJSON<AppSupport>(join(appsDir, id, 'support.json')).catch(() => null);
    if (support?.appName) {
      pages.push({
        path: `/apps/${id}/support`,
        title: `${support.appName} Support`,
        description: summarize(support.subtitle, `Help and contact information for ${support.appName}.`),
        type: 'website',
      });
    }
  }
  return pages;
}

async function collect(): Promise<{ pages: Page[]; posts: PostPreview[] }> {
  const projects = await readList<ProjectPreview>(join(projectsDir, 'index.json'));
  const posts = await readList<PostPreview>(join(postsDir, 'index.json'));
  const newest = (dates: (string | undefined)[]) => dates.filter(Boolean).sort().at(-1);

  const pages: Page[] = [
    { path: '/', title: SITE_NAME, description: SITE_DESCRIPTION, type: 'website' },
    {
      path: '/projects',
      title: 'Projects',
      description: "Things I've built, am building, or broke and rebuilt.",
      type: 'website',
      lastModified: newest(projects.map(p => p.updatedAt ?? p.createdAt)),
    },
    {
      path: '/blog',
      title: 'Blog',
      description: 'Notes from the build log.',
      type: 'website',
      lastModified: newest(posts.map(p => p.updatedAt ?? p.createdAt)),
    },
  ];
  for (const p of projects) {
    pages.push({
      path: `/projects/${p.id}`,
      title: p.title,
      description: summarize(p.tagline, SITE_DESCRIPTION),
      image: await previewImage(p.heroImage),
      type: 'website',
      lastModified: p.updatedAt ?? p.createdAt,
    });
  }
  for (const p of posts) {
    pages.push({
      path: `/blog/${p.id}`,
      title: p.title,
      description: summarize(p.excerpt, SITE_DESCRIPTION),
      image: await previewImage(p.heroImage),
      type: 'article',
      lastModified: p.updatedAt ?? p.createdAt,
    });
  }
  pages.push(...await appPages());
  return { pages, posts };
}

function sitemap(pages: Page[]): string {
  const urls = pages.map(p => {
    const lastmod = p.lastModified && !Number.isNaN(Date.parse(p.lastModified))
      ? `\n    <lastmod>${new Date(p.lastModified).toISOString().slice(0, 10)}</lastmod>`
      : '';
    return `  <url>\n    <loc>${escape(absoluteUrl(p.path))}</loc>${lastmod}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function feed(posts: PostPreview[]): string {
  const items = posts.slice(0, FEED_SIZE).map(p => {
    const link = escape(absoluteUrl(`/blog/${p.id}`));
    const categories = (Array.isArray(p.tags) ? p.tags : []).map(t => `\n      <category>${escape(t)}</category>`).join('');
    return `    <item>
      <title>${escape(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <description>${escape(p.excerpt ?? '')}</description>${categories}
    </item>`;
  });
  const updated = posts[0] ? new Date(posts[0].updatedAt ?? posts[0].createdAt).toUTCString() : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE_NAME)} · Blog</title>
    <link>${escape(absoluteUrl('/blog'))}</link>
    <description>Notes from the build log.</description>
    <language>en-us</language>
    <lastBuildDate>${updated}</lastBuildDate>
    <atom:link href="${escape(absoluteUrl('/feed.xml'))}" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`;
}

/** The deployed index.html with `page`'s metadata in place of the generic title and description. */
export function sharePage(template: string, page: Page): string {
  const title = page.path === '/' ? SITE_NAME : `${page.title} · ${SITE_NAME}`;
  const url = absoluteUrl(page.path);
  const tags = [
    `<link rel="canonical" href="${escape(url)}" />`,
    `<meta property="og:site_name" content="${escape(SITE_NAME)}" />`,
    `<meta property="og:type" content="${page.type}" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    ...(page.image ? [`<meta property="og:image" content="${escape(page.image)}" />`] : []),
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}" />`,
  ];
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escape(page.description)}" />`)
    .replace(/<\/head>/i, `    ${tags.join('\n    ')}\n  </head>`);
}

async function listHtml(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listHtml(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

async function writeSharePages(pages: Page[]): Promise<number | null> {
  const templatePath = join(publicDir, 'index.html');
  if (!await fileExists(templatePath)) return null;
  const template = await readFile(templatePath, 'utf-8');
  const shareRoot = join(publicDir, SHARE_DIR);
  const wanted = new Set<string>();

  for (const page of pages) {
    if (page.path === '/') continue;
    const file = join(shareRoot, `${page.path.slice(1)}.html`);
    wanted.add(file);
    await mkdir(dirname(file), { recursive: true });
    await writeFileAtomic(file, sharePage(template, page));
  }
  // Remove pages for content that no longer exists.
  for (const file of await listHtml(shareRoot)) {
    if (!wanted.has(file)) await unlink(file).catch(() => {});
  }
  return wanted.size;
}

/** Rewrites sitemap.xml, feed.xml, and the share pages. */
export function writeSiteFiles(): Promise<void> {
  return withLock('site', async () => {
    await mkdir(publicDir, { recursive: true });
    const { pages, posts } = await collect();
    await writeFileAtomic(join(publicDir, 'sitemap.xml'), sitemap(pages));
    await writeFileAtomic(join(publicDir, 'feed.xml'), feed(posts));
    const shared = await writeSharePages(pages);
    logger.info(
      `Wrote sitemap.xml (${pages.length} URLs), feed.xml (${Math.min(posts.length, FEED_SIZE)} posts), and ` +
      (shared === null ? `no share pages (no index.html in ${relative(process.cwd(), publicDir) || publicDir})` : `${shared} share pages`),
    );
  });
}

/** writeSiteFiles for callers that have already saved their change: logs a failure instead of throwing. */
export async function refreshSiteFiles(after: string): Promise<void> {
  try {
    await writeSiteFiles();
  } catch (err) {
    logger.error(`${after}, but updating sitemap.xml, feed.xml, or the share pages failed (run npm run regen): ${err}`);
  }
}
