// `npm run media:derive [-- --dry-run]`: creates the 640/1280 px widths for every stored .webp that's
// missing them (images uploaded before sizes were generated). Never changes or deletes originals.
import 'dotenv/config';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import { fileExists, mediaDir } from '../lib/files.js';
import { derivativePaths, isDerivative, writeMissingDerivatives } from '../lib/images.js';

const dryRun = process.argv.includes('--dry-run');

async function listWebp(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listWebp(path));
    else if (entry.name.endsWith('.webp') && !isDerivative(entry.name)) out.push(path);
  }
  return out;
}

if (!await fileExists(mediaDir)) {
  console.error(`Media directory ${mediaDir} doesn't exist.`);
  process.exit(1);
}

let written = 0;
let failed = 0;
for (const path of await listWebp(mediaDir)) {
  const missing = [];
  for (const p of derivativePaths(path)) if (!await fileExists(p)) missing.push(p);
  if (missing.length === 0) continue;
  const name = relative(mediaDir, path);
  if (dryRun) {
    console.log(`would create ${missing.length} size(s) for ${name}`);
    written += missing.length;
    continue;
  }
  try {
    written += await writeMissingDerivatives(path);
    console.log(`created ${missing.length} size(s) for ${name}`);
  } catch (err) {
    failed++;
    console.error(`failed for ${name}: ${(err as Error).message}`);
  }
}
console.log(`${dryRun ? 'Would create' : 'Created'} ${written} file(s)${failed ? `; ${failed} image(s) failed` : ''}.`);
process.exitCode = failed ? 1 : 0;
