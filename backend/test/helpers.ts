// Test setup. Paths are read from the environment when src/lib/files.ts loads, so call setup() before
// importing anything from src (test files import src modules dynamically, after setup()).
import { mkdtemp, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export const TOKEN = 'test-token-that-is-long-enough-1234567890';
export const auth = { Authorization: `Bearer ${TOKEN}` };

export interface TestDirs {
  root: string;
  data: string;
  publicDir: string;
  media: string;
}

export async function setup(options: { bootstrap?: boolean; indexHtml?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-test-'));
  const dirs: TestDirs = { root, data: join(root, 'data'), publicDir: join(root, 'public_html'), media: join(root, 'public_html', 'media') };
  process.env.DATA_DIR = dirs.data;
  process.env.PUBLIC_DIR = dirs.publicDir;
  process.env.MEDIA_DIR = dirs.media;
  process.env.SITE_URL = 'https://example.test';
  process.env.API_SECRET = TOKEN;
  // The logger writes logs/app.log under the working directory; keep it in the temp dir, and quiet.
  process.chdir(root);
  for (const method of ['log', 'warn', 'error'] as const) console[method] = () => {};

  if (options.indexHtml) {
    await mkdir(dirs.publicDir, { recursive: true });
    await writeFile(
      join(dirs.publicDir, 'index.html'),
      '<!doctype html>\n<html lang="en">\n  <head>\n    <meta name="description" content="Jordan Christensen" />\n    <title>Jordan</title>\n  </head>\n  <body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body>\n</html>\n',
    );
  }

  const { createApp } = await import('../src/app.js');
  if (options.bootstrap !== false) {
    const { ensureStorage } = await import('../src/lib/bootstrap.js');
    await ensureStorage();
  }
  const { default: request } = await import('supertest');
  return { dirs, api: request(createApp()) };
}

/** A valid project body, as Folio sends it on create. */
export function projectBody(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Project ${id}`,
    tagline: 'A tagline',
    heroImage: '',
    category: 'Web',
    status: 'active',
    featured: false,
    createdAt: '2025-02-14T00:00:00Z',
    description: 'Hello',
    media: [],
    techStack: ['Swift'],
    links: { GitHub: 'https://github.com/mazjap' },
    ...overrides,
  };
}

export function postBody(id: string, overrides: Record<string, unknown> = {}) {
  return { id, title: `Post ${id}`, excerpt: 'An excerpt', content: 'one two three', tags: ['swift'], ...overrides };
}
