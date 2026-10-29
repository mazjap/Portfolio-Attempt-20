import { readdir } from 'fs/promises';
import { join } from 'path';
import { readJSON, writeJSON, projectsDir, postsDir } from './files.js';
import { logger } from './logger.js';
import { listingProblems } from './schemas.js';
import type { ProjectDetail, ProjectPreview, ProjectNav, PostDetail, PostPreview, PostNav } from './types.js';

export const PROJECTION_FILES = new Set(['index.json', 'nav.json']);

export interface SkippedRecord {
  file: string;
  reason: string;
}

export interface LoadResult<T> {
  records: T[];
  skipped: SkippedRecord[];
}

/** The content record files in `dir` (every `.json` except the generated projections). */
export async function recordFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter(f => f.endsWith('.json') && !f.startsWith('.') && !PROJECTION_FILES.has(f)).sort();
}

/**
 * Reads every record in `dir`. Files that aren't valid JSON, or lack the fields the lists need, are
 * skipped and reported rather than failing the whole load. The filename is the record's ID (it's
 * what `GET /:id` reads), so a mismatched `id` inside the file is corrected with a warning.
 */
export async function loadRecords<T extends { id: string }>(kind: 'projects' | 'posts', dir: string): Promise<LoadResult<T>> {
  const files = await recordFiles(dir);
  const results = await Promise.allSettled(files.map(f => readJSON<unknown>(join(dir, f))));
  const records: T[] = [];
  const skipped: SkippedRecord[] = [];

  results.forEach((result, i) => {
    const file = files[i];
    if (result.status === 'rejected') {
      skipped.push({ file, reason: `can't be read: ${(result.reason as Error).message}` });
      return;
    }
    const problems = listingProblems(kind, result.value);
    if (problems.length) {
      skipped.push({ file, reason: problems.join('; ') });
      return;
    }
    const record = result.value as T;
    const id = file.slice(0, -'.json'.length);
    if (record.id !== id) {
      logger.warn(`${kind}/${file}: id ${JSON.stringify(record.id)} doesn't match its filename; listing it as "${id}"`);
      record.id = id;
    }
    records.push(record);
  });

  return { records, skipped };
}

export function projectProjections(projects: ProjectDetail[]): { index: ProjectPreview[]; nav: ProjectNav[] } {
  const date = (p: ProjectDetail) => new Date(p.updatedAt ?? p.createdAt).getTime();
  const sorted = [...projects].sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    return date(b) - date(a);
  });

  const index: ProjectPreview[] = sorted.map(({ id, title, tagline, heroImage, category, status, featured, createdAt, updatedAt }) => ({
    id, title, tagline, heroImage: heroImage ?? '', status, featured: Boolean(featured), createdAt,
    ...(category && { category }),
    ...(updatedAt && { updatedAt }),
  }));

  const nav: ProjectNav[] = sorted.map(({ id, title, status, featured }) => ({ id, title, status, ...(featured && { featured }) }));

  return { index, nav };
}

export function postProjections(posts: PostDetail[]): { index: PostPreview[]; nav: PostNav[] } {
  const sorted = [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const index: PostPreview[] = sorted.map(({ id, title, excerpt, heroImage, tags, createdAt, updatedAt, readingTime, series }) => ({
    id, title, excerpt: excerpt ?? '', tags, createdAt, readingTime,
    ...(heroImage && { heroImage }),
    ...(updatedAt && { updatedAt }),
    ...(series && { series }),
  }));

  const nav: PostNav[] = sorted.map(({ id, title, tags, createdAt, series }) => ({
    id, title, tags, createdAt,
    ...(series && { series }),
  }));

  return { index, nav };
}

export interface RegenerateReport {
  listed: number;
  skipped: SkippedRecord[];
}

async function regenerate<T extends { id: string }>(
  kind: 'projects' | 'posts',
  dir: string,
  project: (records: T[]) => { index: unknown[]; nav: unknown[] },
): Promise<RegenerateReport> {
  const { records, skipped } = await loadRecords<T>(kind, dir);
  for (const { file, reason } of skipped) logger.error(`Skipped ${kind}/${file} while regenerating: ${reason}`);

  // If every record failed, something is badly wrong; keep the last good lists rather than publishing empty ones.
  if (records.length === 0 && skipped.length > 0) {
    logger.error(`No readable ${kind}; kept the existing index.json and nav.json`);
    return { listed: 0, skipped };
  }

  const { index, nav } = project(records);
  // index first: if the second write fails, the list pages are still current.
  await writeJSON(join(dir, 'index.json'), index);
  await writeJSON(join(dir, 'nav.json'), nav);
  logger.info(`Regenerated ${kind} index (${index.length} listed${skipped.length ? `, ${skipped.length} skipped` : ''})`);
  return { listed: index.length, skipped };
}

export function regenerateProjects(): Promise<RegenerateReport> {
  return regenerate<ProjectDetail>('projects', projectsDir, projectProjections);
}

export function regeneratePosts(): Promise<RegenerateReport> {
  return regenerate<PostDetail>('posts', postsDir, postProjections);
}
