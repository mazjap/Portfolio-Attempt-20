// A read-only copy of a deployed site's content, made with public GET requests only, for backups
// without server access (see "Backups" in DEPLOY.md). Used by `npm run snapshot`.
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export interface SnapshotResult {
  projects: number;
  posts: number;
  appPages: number;
  media: number;
  mediaBytes: number;
  /** What couldn't be saved, one line each (like "/media/x.jpg: HTTP 404"). */
  failures: string[];
  /** The text written to MANIFEST.txt. */
  manifest: string;
}

/** The app IDs in a sitemap's `/apps/<id>/privacy-policy` and `/apps/<id>/support` URLs. */
export function appIdsFromSitemap(xml: string): string[] {
  const ids = new Set<string>();
  for (const match of xml.matchAll(/<loc>[^<]*\/apps\/([a-z0-9-]+)\/(?:privacy-policy|support)\/?<\/loc>/g)) ids.add(match[1]);
  return [...ids].sort();
}

/** Every `/media/…` path a record uses: `heroImage`, `media[].url`, and links in Markdown bodies. */
export function mediaPathsIn(record: unknown): string[] {
  if (typeof record !== 'object' || record === null) return [];
  const r = record as { heroImage?: unknown; media?: unknown; description?: unknown; content?: unknown };
  const paths: string[] = [];
  if (typeof r.heroImage === 'string' && r.heroImage.startsWith('/media/')) paths.push(r.heroImage);
  for (const item of Array.isArray(r.media) ? r.media : []) {
    const url = (item as { url?: unknown } | null)?.url;
    if (typeof url === 'string' && url.startsWith('/media/')) paths.push(url);
  }
  for (const body of [r.description, r.content]) {
    if (typeof body === 'string') for (const m of body.matchAll(/\/media\/[^\s"'()<>]+/g)) paths.push(m[0]);
  }
  return paths;
}

/**
 * Saves every project, post, and app page (`appIds`), the list files, and every media file the content
 * uses into `outDir`, laid out like the server (`data/…`, `public_html/media/…`), plus MANIFEST.txt.
 * Only sends GETs. Failures are recorded, not thrown, so one missing image doesn't stop the backup.
 */
export async function takeSnapshot({ siteUrl, outDir, appIds }: { siteUrl: string; outDir: string; appIds: string[] }): Promise<SnapshotResult> {
  const base = siteUrl.replace(/\/+$/, '');
  const result: SnapshotResult = { projects: 0, posts: 0, appPages: 0, media: 0, mediaBytes: 0, failures: [], manifest: '' };
  const mediaPaths = new Set<string>();

  const get = (path: string) => fetch(base + path, { headers: { 'user-agent': 'portfolio-snapshot' } });
  async function getJSON(path: string): Promise<unknown> {
    const res = await get(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function save(rel: string, contents: string | Buffer): Promise<void> {
    const path = join(outDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
  const saveJSON = (rel: string, value: unknown) => save(rel, JSON.stringify(value, null, 2));

  for (const kind of ['projects', 'posts'] as const) {
    let index: unknown;
    try {
      index = await getJSON(`/api/${kind}`);
      await saveJSON(`data/${kind}/index.json`, index);
      await saveJSON(`data/${kind}/nav.json`, await getJSON(`/api/${kind}/nav`));
    } catch (err) {
      result.failures.push(`${kind} list: ${(err as Error).message}`);
      continue;
    }
    for (const item of Array.isArray(index) ? index : []) {
      const id = (item as { id?: unknown })?.id;
      if (typeof id !== 'string') continue;
      try {
        const record = await getJSON(`/api/${kind}/${encodeURIComponent(id)}`);
        await saveJSON(`data/${kind}/${id}.json`, record);
        mediaPathsIn(record).forEach(p => mediaPaths.add(p));
        result[kind]++;
      } catch (err) {
        result.failures.push(`${kind}/${id}: ${(err as Error).message}`);
      }
    }
  }

  for (const id of appIds) {
    for (const page of ['privacy-policy', 'support']) {
      const res = await get(`/api/apps/${encodeURIComponent(id)}/${page}`);
      if (res.status === 404) continue;
      if (!res.ok) {
        result.failures.push(`apps/${id}/${page}: HTTP ${res.status}`);
        continue;
      }
      const record = await res.json();
      await saveJSON(`data/apps/${id}/${page}.json`, record);
      mediaPathsIn(record).forEach(p => mediaPaths.add(p));
      result.appPages++;
    }
  }

  for (const url of [...mediaPaths].sort()) {
    let path = url;
    try {
      path = decodeURIComponent(url);
    } catch {
      // Not percent-encoded; use it as is.
    }
    if (path.split('/').includes('..')) {
      result.failures.push(`${path}: skipped (not a plain media path)`);
      continue;
    }
    const res = await get(encodeURI(path));
    if (!res.ok) {
      result.failures.push(`${path}: HTTP ${res.status}`);
      continue;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    await save(`public_html${path}`, bytes);
    result.media++;
    result.mediaBytes += bytes.length;
  }

  result.manifest = [
    `Snapshot of ${base}, taken ${new Date().toISOString()} with public GET requests (npm run snapshot).`,
    '',
    `Projects: ${result.projects}`,
    `Posts: ${result.posts}`,
    `App pages: ${result.appPages}${appIds.length ? ` (apps: ${appIds.join(', ')})` : ' (no app IDs found)'}`,
    `Media files: ${result.media} (${(result.mediaBytes / 1024 / 1024).toFixed(1)} MB), every /media file the content uses`,
    '',
    'Layout matches the server: data/ is ~/data, public_html/ is ~/public_html. JSON is re-serialized from',
    "the API (same content, possibly different formatting from the files on disk). The 640/1280 px image",
    'sizes are left out: node scripts/derive-media.js recreates them.',
    '',
    'Not included (needs cPanel or SSH): media files nothing uses, .htaccess, the Node app\'s settings',
    '(like API_SECRET), logs, and the deployed code.',
    '',
    result.failures.length ? `Problems (${result.failures.length}):\n${result.failures.map(f => `  ${f}`).join('\n')}` : 'Problems: none',
  ].join('\n');
  await save('MANIFEST.txt', result.manifest + '\n');
  return result;
}
