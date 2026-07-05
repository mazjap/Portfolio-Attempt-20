import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const dataDir = join(import.meta.dirname, '..', '..', 'data');

export const projectsDir = join(dataDir, 'projects');
export const postsDir = join(dataDir, 'posts');
export const mediaDir = process.env.MEDIA_DIR ?? join(import.meta.dirname, '..', '..', 'public_html', 'media');

export async function readJSON<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, 'utf-8');
  return JSON.parse(text) as T;
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
