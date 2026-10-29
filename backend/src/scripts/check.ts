// Read-only integrity report: `npm run check`. Changes nothing; exits with 1 if anything is an error.
import 'dotenv/config';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import { appsDir, fileExists, mediaDir, postsDir, projectsDir, readJSON } from '../lib/files.js';
import { derivativePaths, isDerivative } from '../lib/images.js';
import { isValidContentId, isValidSlug } from '../lib/paths.js';
import { loadRecords, postProjections, projectProjections, recordFiles } from '../lib/regenerate.js';
import { listingProblems, parse, postSchema, privacyPolicySchema, projectSchema, supportSchema } from '../lib/schemas.js';
import type { PostDetail, ProjectDetail } from '../lib/types.js';

type Level = 'error' | 'warning' | 'info';
const issues: { level: Level; where: string; message: string }[] = [];
const report = (level: Level, where: string, message: string) => issues.push({ level, where, message });

/** Every `/media/…` path the content uses: `heroImage`, `media[].url`, and links in Markdown bodies. */
const referencedMedia = new Set<string>();
// NFC on both sides: macOS can hand back a filename in a different Unicode form than the content stores.
function addReference(url: string): void {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {}
  referencedMedia.add(decoded.normalize('NFC'));
}
function collectMediaReferences(record: unknown): void {
  if (typeof record !== 'object' || record === null) return;
  const r = record as { heroImage?: unknown; media?: unknown; content?: unknown; description?: unknown };
  // Exact strings first: these can contain spaces.
  if (typeof r.heroImage === 'string' && r.heroImage.startsWith('/media/')) addReference(r.heroImage);
  if (Array.isArray(r.media)) {
    for (const item of r.media) {
      const url = (item as { url?: unknown })?.url;
      if (typeof url === 'string' && url.startsWith('/media/')) addReference(url);
    }
  }
  for (const body of [r.content, r.description]) {
    if (typeof body !== 'string') continue;
    for (const match of body.matchAll(/\/media\/[^\s"'()<>]+/g)) addReference(match[0]);
  }
}

async function checkContent(kind: 'projects' | 'posts', dir: string, schema: typeof projectSchema): Promise<void> {
  for (const file of await recordFiles(dir)) {
    const where = `data/${kind}/${file}`;
    const id = file.slice(0, -'.json'.length);
    let record: unknown;
    try {
      record = await readJSON(join(dir, file));
    } catch (err) {
      report('error', where, `can't be read: ${(err as Error).message}`);
      continue;
    }
    collectMediaReferences(record);
    if (!isValidContentId(id)) report('warning', where, `the filename isn't a valid ID, so GET /api/${kind}/${id} can't reach it`);
    const problems = listingProblems(kind, record);
    if (problems.length) report('error', where, `left out of the lists: ${problems.join('; ')}`);
    const parsed = parse(schema, record, 'stored');
    if (!parsed.ok) report('warning', where, `would be rejected if sent today: ${parsed.errors.join('; ')}`);
    else if (parsed.ignored.length) report('info', where, `has fields the API doesn't know: ${parsed.ignored.join(', ')}`);
    if ((record as { id?: unknown }).id !== id) report('warning', where, `its id ${JSON.stringify((record as { id?: unknown }).id)} doesn't match the filename`);
  }
}

async function checkProjections<T extends { id: string }>(
  kind: 'projects' | 'posts',
  dir: string,
  project: (records: T[]) => { index: unknown[]; nav: unknown[] },
): Promise<void> {
  const { records } = await loadRecords<T>(kind, dir);
  const expected = project(records);
  for (const name of ['index', 'nav'] as const) {
    const where = `data/${kind}/${name}.json`;
    try {
      const actual = await readJSON(join(dir, `${name}.json`));
      if (JSON.stringify(actual) !== JSON.stringify(expected[name])) report('warning', where, 'out of date; run npm run regen');
    } catch {
      report('error', where, 'missing or unreadable; run npm run regen (the server also rebuilds it at startup)');
    }
  }
}

async function checkApps(): Promise<void> {
  const pages = { 'privacy-policy.json': privacyPolicySchema, 'support.json': supportSchema } as const;
  for (const entry of await readdir(appsDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const where = `data/apps/${entry.name}`;
    if (!entry.isDirectory()) {
      report('warning', where, 'unexpected file (apps are folders)');
      continue;
    }
    if (!isValidSlug(entry.name)) report('warning', where, "the folder name isn't a valid app ID, so its pages can't be reached");
    for (const file of await readdir(join(appsDir, entry.name))) {
      if (file.startsWith('.')) continue;
      const schema = pages[file as keyof typeof pages];
      if (!schema) {
        report('warning', `${where}/${file}`, 'unexpected file');
        continue;
      }
      try {
        const page = await readJSON(join(appsDir, entry.name, file));
        collectMediaReferences(page);
        const parsed = parse(schema, page, 'stored');
        if (!parsed.ok) report('warning', `${where}/${file}`, `would be rejected if sent today: ${parsed.errors.join('; ')}`);
      } catch (err) {
        report('error', `${where}/${file}`, `can't be read: ${(err as Error).message}`);
      }
    }
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path));
    else out.push(path);
  }
  return out;
}

async function checkMedia(): Promise<void> {
  if (!await fileExists(mediaDir)) {
    report('warning', 'media', `media directory ${mediaDir} doesn't exist`);
    return;
  }
  const files = await listFiles(mediaDir);
  const toUrl = (path: string) => `/media/${relative(mediaDir, path).split('\\').join('/')}`.normalize('NFC');
  const present = new Set(files.map(toUrl));
  for (const path of files) {
    const url = toUrl(path);
    const name = url.slice(url.lastIndexOf('/') + 1);
    if (name === '.DS_Store') continue;
    if (name.startsWith('.') && name.endsWith('.tmp')) {
      report('warning', url, 'leftover temporary file from an interrupted upload; safe to delete');
      continue;
    }
    // A smaller width (`x.w640.webp`) belongs to its main image (`x.webp`).
    const owner = isDerivative(url) ? url.replace(/\.w\d+\.webp$/, '.webp') : url;
    if (!referencedMedia.has(owner)) report('info', url, 'not referenced by any content (not deleted)');
  }
  let missingSizes = 0;
  for (const url of referencedMedia) {
    if (!present.has(url)) report('warning', url, `referenced by content but missing from ${mediaDir}`);
    else if (url.endsWith('.webp') && derivativePaths(url).some(p => !present.has(p))) missingSizes++;
  }
  if (missingSizes) {
    report('info', 'media', `${missingSizes} image(s) don't have their 640/1280 px sizes yet; run npm run media:derive (the site falls back to the full image meanwhile)`);
  }
}

await checkContent('projects', projectsDir, projectSchema);
await checkContent('posts', postsDir, postSchema);
await checkProjections<ProjectDetail>('projects', projectsDir, projectProjections);
await checkProjections<PostDetail>('posts', postsDir, postProjections);
await checkApps();
await checkMedia();

const order: Level[] = ['error', 'warning', 'info'];
for (const level of order) {
  const group = issues.filter(i => i.level === level);
  if (!group.length) continue;
  console.log(`\n${level.toUpperCase()}S (${group.length})`);
  for (const { where, message } of group) console.log(`  ${where}: ${message}`);
}
const errors = issues.filter(i => i.level === 'error').length;
console.log(`\n${errors} errors, ${issues.length - errors} warnings and notes. Nothing was changed.`);
process.exit(errors ? 1 : 0);
