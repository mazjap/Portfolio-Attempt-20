// Which content uses which media files: for `npm run check`, `npm run snapshot`, refusing to delete a
// file that's still in use, and cleaning up an item's folder when it's deleted.
import { readdir, readFile, rmdir, unlink } from 'fs/promises';
import { join } from 'path';
import { appsDir, fileExists, mediaDir, postsDir, projectsDir } from './files.js';
import { derivativePaths, isDerivative } from './images.js';
import { logger } from './logger.js';
import { resolveInside } from './paths.js';
import { recordFiles } from './regenerate.js';

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

/** A media path as stored, compared without percent-encoding and in one Unicode form (macOS can return filenames in another). */
export function normalizeMediaPath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Not percent-encoded; use it as is.
  }
  return decoded.normalize('NFC');
}

interface ContentFile {
  /** Like `post "hello"` or `trekpoint support page`, for messages. */
  label: string;
  /** Every string in the record (or the raw file, if it isn't valid JSON), NFC-normalized. */
  text: string[];
}

function stringsIn(value: unknown, out: string[]): string[] {
  if (typeof value === 'string') out.push(value.normalize('NFC'));
  else if (Array.isArray(value)) value.forEach(v => stringsIn(v, out));
  else if (typeof value === 'object' && value !== null) Object.values(value).forEach(v => stringsIn(v, out));
  return out;
}

async function readContentFile(path: string, label: string): Promise<ContentFile> {
  const raw = await readFile(path, 'utf-8');
  try {
    return { label, text: stringsIn(JSON.parse(raw), []) };
  } catch {
    return { label, text: [raw.normalize('NFC')] };
  }
}

/** Every project, post, and app page on disk (unreadable files are logged and left out). */
async function contentFiles(): Promise<ContentFile[]> {
  const files: Promise<ContentFile>[] = [];
  for (const [dir, kind] of [[projectsDir, 'project'], [postsDir, 'post']] as const) {
    if (!await fileExists(dir)) continue;
    for (const file of await recordFiles(dir)) files.push(readContentFile(join(dir, file), `${kind} "${file.slice(0, -'.json'.length)}"`));
  }
  if (await fileExists(appsDir)) {
    for (const app of await readdir(appsDir, { withFileTypes: true })) {
      if (!app.isDirectory() || app.name.startsWith('.')) continue;
      for (const [file, page] of [['privacy-policy.json', 'privacy policy'], ['support.json', 'support page']] as const) {
        const path = join(appsDir, app.name, file);
        if (await fileExists(path)) files.push(readContentFile(path, `${app.name} ${page}`));
      }
    }
  }
  const results = await Promise.allSettled(files);
  return results.flatMap(result => {
    if (result.status === 'fulfilled') return [result.value];
    logger.error(`Couldn't read a content file while checking media references: ${result.reason}`);
    return [];
  });
}

/**
 * For each media path (like `/media/posts/hello/hero.webp`), the content that mentions it. A file
 * counts as used if any string in a record contains its path, as is or percent-encoded, so Markdown
 * links with spaces, absolute URLs, and fields added later are all covered. It errs toward "used".
 */
export async function findUsers(paths: string[]): Promise<Map<string, string[]>> {
  const content = await contentFiles();
  const users = new Map<string, string[]>();
  for (const path of paths) {
    const forms = [...new Set([path, encodeURI(path)].map(p => p.normalize('NFC')))];
    const labels = content.filter(file => file.text.some(text => forms.some(form => text.includes(form)))).map(file => file.label);
    if (labels.length) users.set(path, labels);
  }
  return users;
}

/** `/media/<context>/<id>/<filename>`, and its smaller sizes when it's a main image. */
export function mediaPathWithSizes(context: string, id: string, filename: string): string[] {
  const path = `/media/${context}/${id}/${filename}`;
  return isDerivative(path) || !path.endsWith('.webp') ? [path] : [path, ...derivativePaths(path)];
}

export function usedByMessage(users: string[]): string {
  const shown = users.slice(0, 3).join(', ');
  return users.length > 3 ? `${shown}, and ${users.length - 3} more` : shown;
}

/**
 * After a project or post is deleted, deletes the files in its media folder that no remaining content
 * uses, then the folder if it's empty. Files another item still uses are kept (they'd break its page).
 * Call it inside the `media` lock. Failures are logged, not thrown: the record is already deleted.
 */
export async function deleteUnusedItemMedia(context: 'projects' | 'posts', id: string): Promise<{ deleted: string[]; kept: string[] }> {
  const result = { deleted: [] as string[], kept: [] as string[] };
  const dir = resolveInside(mediaDir, context, id);
  try {
    if (!await fileExists(dir)) return result;
    const names = (await readdir(dir, { withFileTypes: true })).filter(e => e.isFile()).map(e => e.name);
    const users = await findUsers(names.map(name => `/media/${context}/${id}/${name}`));
    // A smaller size stays with its main image, and the main image stays if any size is used.
    const owner = (name: string) => (isDerivative(name) ? name.replace(/\.w\d+\.webp$/, '.webp') : name);
    const keptOwners = new Set(names.filter(name => users.has(`/media/${context}/${id}/${name}`)).map(owner));
    for (const name of names) {
      const path = `/media/${context}/${id}/${name}`;
      if (keptOwners.has(owner(name))) {
        result.kept.push(path);
        continue;
      }
      await unlink(join(dir, name));
      result.deleted.push(path);
    }
    if (!result.kept.length) await rmdir(dir).catch(() => {});
    if (result.deleted.length) logger.info(`Deleted ${result.deleted.length} unused media file(s) of ${context}/${id}`);
    if (result.kept.length) logger.warn(`Kept ${result.kept.length} media file(s) of deleted ${context}/${id} that other content uses: ${result.kept.join(', ')}`);
  } catch (err) {
    logger.error(`Deleting ${context}/${id} was saved, but cleaning up its media folder failed (npm run check lists what's left): ${err}`);
  }
  return result;
}
