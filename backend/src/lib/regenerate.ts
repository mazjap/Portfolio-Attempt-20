import { readdir } from 'fs/promises';
import { join } from 'path';
import { readJSON, writeJSON, projectsDir, postsDir } from './files.js';
import { logger } from './logger.js';
import type { ProjectDetail, ProjectPreview, ProjectNav, PostDetail, PostPreview, PostNav } from './types.js';

export async function regenerateProjects(): Promise<void> {
  const files = await readdir(projectsDir);
  const ids = files
    .filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'nav.json')
    .map(f => f.slice(0, -5));

  const projects = await Promise.all(
    ids.map(id => readJSON<ProjectDetail>(join(projectsDir, `${id}.json`)))
  );

  projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const index: ProjectPreview[] = projects.map(({ id, title, tagline, heroImage, category, status, featured, createdAt, updatedAt }) => ({
    id, title, tagline, heroImage, status, featured, createdAt,
    ...(category && { category }),
    ...(updatedAt && { updatedAt }),
  }));

  const nav: ProjectNav[] = projects.map(({ id, title, status }) => ({ id, title, status }));

  await Promise.all([
    writeJSON(join(projectsDir, 'index.json'), index),
    writeJSON(join(projectsDir, 'nav.json'), nav),
  ]);
  logger.info(`Regenerated projects index (${index.length} projects)`);
}

export async function regeneratePosts(): Promise<void> {
  const files = await readdir(postsDir);
  const ids = files
    .filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'nav.json')
    .map(f => f.slice(0, -5));

  const posts = await Promise.all(
    ids.map(id => readJSON<PostDetail>(join(postsDir, `${id}.json`)))
  );

  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const index: PostPreview[] = posts.map(({ id, title, excerpt, heroImage, tags, createdAt, updatedAt, readingTime, series }) => ({
    id, title, excerpt, tags, createdAt, readingTime,
    ...(heroImage && { heroImage }),
    ...(updatedAt && { updatedAt }),
    ...(series && { series }),
  }));

  const nav: PostNav[] = posts.map(({ id, title, tags, createdAt, series }) => ({
    id, title, tags, createdAt,
    ...(series && { series }),
  }));

  await Promise.all([
    writeJSON(join(postsDir, 'index.json'), index),
    writeJSON(join(postsDir, 'nav.json'), nav),
  ]);
  logger.info(`Regenerated posts index (${index.length} posts)`);
}
