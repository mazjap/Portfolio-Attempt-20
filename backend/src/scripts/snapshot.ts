// `npm run snapshot [-- <outDir>] [-- --site <url>]`: backs up the live site's content with public GETs
// (see "Backups" in DEPLOY.md). Writes <outDir> and <outDir>.tgz; exits with 1 if anything failed.
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import { appIdsFromSitemap, takeSnapshot } from '../lib/snapshot.js';

const args = process.argv.slice(2);
const siteFlag = args.indexOf('--site');
const siteUrl = (siteFlag >= 0 ? args[siteFlag + 1] : undefined) ?? 'https://jordan-christensen.com';
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--site');

// Default: ~/Developer/portfolio-backups/<date>-live, with a suffix if that day's snapshot exists.
function defaultOutDir(): string {
  const root = join(homedir(), 'Developer', 'portfolio-backups');
  const day = new Date().toISOString().slice(0, 10);
  let dir = join(root, `${day}-live`);
  for (let n = 2; existsSync(dir) || existsSync(`${dir}.tgz`); n++) dir = join(root, `${day}-live-${n}`);
  return dir;
}

const outDir = positional[0] ? resolve(positional[0]) : defaultOutDir();
if (existsSync(outDir)) {
  console.error(`${outDir} already exists; choose another folder so an earlier snapshot isn't mixed in.`);
  process.exit(1);
}

// App IDs come from GET /api/apps; a server deployed before it existed only lists them in the sitemap.
const base = siteUrl.replace(/\/+$/, '');
let appIds: string[] = [];
try {
  const res = await fetch(`${base}/api/apps`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const apps = await res.json() as { id?: unknown }[];
  appIds = apps.map(app => app.id).filter((id): id is string => typeof id === 'string');
} catch {
  try {
    const res = await fetch(`${base}/sitemap.xml`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    appIds = appIdsFromSitemap(await res.text());
  } catch (err) {
    console.error(`Couldn't read the app list or the sitemap for app IDs (${(err as Error).message}); app pages will be missing.`);
  }
}

const result = await takeSnapshot({ siteUrl, outDir, appIds });
console.log(result.manifest);

const archive = `${outDir}.tgz`;
const tar = spawnSync('tar', ['czf', archive, '-C', dirname(outDir), basename(outDir)], { stdio: 'inherit' });
console.log(tar.status === 0 ? `\nSaved ${outDir} and ${archive}.` : `\nSaved ${outDir}, but creating ${archive} failed.`);
process.exitCode = result.failures.length || tar.status !== 0 ? 1 : 0;
