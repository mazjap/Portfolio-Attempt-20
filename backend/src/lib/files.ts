import { access, readFile, writeFile, rename, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import { basename, dirname, join } from 'path';

// Defaults are relative to the compiled file: `backend/` locally, the home directory on the server
// (see "Path Resolution" in DEVDOC.md). The environment variables override them (tests use temp dirs).
const root = join(import.meta.dirname, '..', '..');

export const dataDir = process.env.DATA_DIR ?? join(root, 'data');

export const projectsDir = join(dataDir, 'projects');
export const postsDir = join(dataDir, 'posts');
export const appsDir = join(dataDir, 'apps');
/** The web root the frontend is deployed to; sitemap.xml, feed.xml, and the share pages go here. */
export const publicDir = process.env.PUBLIC_DIR ?? join(root, 'public_html');
export const mediaDir = process.env.MEDIA_DIR ?? join(publicDir, 'media');
/** The public site's origin, for absolute URLs in the sitemap, feed, and share metadata. */
export const siteUrl = (process.env.SITE_URL ?? 'https://jordan-christensen.com').replace(/\/+$/, '');

export async function readJSON<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, 'utf-8');
  return JSON.parse(text) as T;
}

/** A hidden temporary path beside `filePath`, so a rename onto it stays on one filesystem. */
export function tempPathFor(filePath: string): string {
  return join(dirname(filePath), `.${basename(filePath)}.${randomBytes(6).toString('hex')}.tmp`);
}

/**
 * Writes to a temporary file and renames it into place, so readers see either the old file or the
 * new one, never a partial write.
 */
export async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  const tempPath = tempPathFor(filePath);
  try {
    await writeFile(tempPath, contents, 'utf-8');
    await rename(tempPath, filePath);
  } catch (err) {
    await unlink(tempPath).catch(() => {});
    throw err;
  }
}

export function writeJSON(filePath: string, data: unknown): Promise<void> {
  return writeFileAtomic(filePath, JSON.stringify(data, null, 2));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
