import { access, constants, mkdir } from 'fs/promises';
import { join } from 'path';
import { appsDir, mediaDir, postsDir, projectsDir, readJSON } from './files.js';
import { logger } from './logger.js';
import { regeneratePosts, regenerateProjects } from './regenerate.js';
import { withLock } from './lock.js';
import { refreshSiteFiles } from './site.js';

export const STORAGE_DIRS = [projectsDir, postsDir, appsDir, mediaDir];

/** Whether every storage directory exists and can be read and written. */
export async function storageIsWritable(): Promise<boolean> {
  try {
    await Promise.all(STORAGE_DIRS.map(dir => access(dir, constants.R_OK | constants.W_OK)));
    return true;
  } catch {
    return false;
  }
}

async function projectionsAreReadable(dir: string): Promise<boolean> {
  try {
    const [index, nav] = await Promise.all([readJSON(join(dir, 'index.json')), readJSON(join(dir, 'nav.json'))]);
    return Array.isArray(index) && Array.isArray(nav);
  } catch {
    return false;
  }
}

/**
 * Idempotent startup setup: creates missing storage directories, regenerates index.json/nav.json
 * when either is missing or unreadable, and rewrites sitemap.xml, feed.xml, and the share pages.
 * Problems are logged; the server still starts so reads keep working.
 */
export async function ensureStorage(): Promise<void> {
  for (const dir of STORAGE_DIRS) {
    try {
      await mkdir(dir, { recursive: true });
    } catch (err) {
      logger.error(`Can't create storage directory ${dir}: ${err}`);
    }
  }
  if (!await storageIsWritable()) {
    logger.error(`A storage directory isn't readable and writable; writes will fail. Checked: ${STORAGE_DIRS.join(', ')}`);
  }

  const kinds = [
    { kind: 'projects', dir: projectsDir, regenerate: regenerateProjects },
    { kind: 'posts', dir: postsDir, regenerate: regeneratePosts },
  ];
  for (const { kind, dir, regenerate } of kinds) {
    if (await projectionsAreReadable(dir)) continue;
    logger.warn(`${kind} index.json or nav.json is missing or unreadable; regenerating`);
    try {
      await withLock(kind, regenerate);
    } catch (err) {
      logger.error(`Regenerating the ${kind} index failed: ${err}`);
    }
  }

  // Always, so share pages pick up a newly deployed index.html when the server restarts.
  await refreshSiteFiles('Startup finished');
}

/** Logs configuration problems at startup without revealing secrets. */
export function checkConfiguration(): void {
  const secret = process.env.API_SECRET;
  if (!secret) {
    logger.error('API_SECRET is not set; every write request will be rejected with 401');
  } else if (secret.length < 32) {
    logger.warn(`API_SECRET is only ${secret.length} characters; use at least 32 random characters`);
  }
}
