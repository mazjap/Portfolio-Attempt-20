import { rename, unlink } from 'fs/promises';
import sharp, { type ResizeOptions } from 'sharp';
import { fileExists, tempPathFor } from './files.js';

/** The longest side an uploaded image is stored at (the original file is never kept). */
export const MAX_DIMENSION = 2560;
/** Smaller widths saved beside each image (`name.w640.webp`), for `srcset` on cards and thumbnails. */
export const DERIVATIVE_WIDTHS = [640, 1280] as const;
export const MAX_PIXELS = 100_000_000;
const QUALITY = 85;

const DERIVATIVE = /\.w\d+\.webp$/;

export function isDerivative(path: string): boolean {
  return DERIVATIVE.test(path);
}

/** `…/hero.webp` → `…/hero.w640.webp`. */
export function derivativePath(path: string, width: number): string {
  return path.replace(/\.webp$/, `.w${width}.webp`);
}

export function derivativePaths(path: string): string[] {
  return DERIVATIVE_WIDTHS.map(w => derivativePath(path, w));
}

interface Target {
  path: string;
  resize: ResizeOptions;
}

/**
 * Writes `input` as WebP to every target: each goes to a temp file first, and nothing is renamed into
 * place until all of them succeeded. The derivatives are renamed before the main file, so whenever the
 * main file exists, so do its smaller sizes. `rotate()` applies the EXIF orientation first.
 */
async function writeTargets(input: string, targets: Target[], animated: boolean): Promise<void> {
  const staged: { temp: string; path: string }[] = [];
  try {
    for (const { path, resize } of targets) {
      const temp = tempPathFor(path);
      staged.push({ temp, path });
      await sharp(input, { animated, limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize({ ...resize, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(temp);
    }
    for (const { temp, path } of [...staged].reverse()) await rename(temp, path);
  } catch (err) {
    await Promise.all(staged.map(({ temp }) => unlink(temp).catch(() => {})));
    throw err;
  }
}

/** Converts an upload to `destPath` (bounded to MAX_DIMENSION) plus its smaller widths. */
export function writeImageSet(input: string, destPath: string, animated: boolean): Promise<void> {
  return writeTargets(
    input,
    [
      { path: destPath, resize: { width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside' } },
      ...DERIVATIVE_WIDTHS.map(width => ({ path: derivativePath(destPath, width), resize: { width } })),
    ],
    animated,
  );
}

/** Creates whichever smaller widths of an existing `.webp` are missing. Returns how many it wrote. */
export async function writeMissingDerivatives(webpPath: string): Promise<number> {
  const missing: Target[] = [];
  for (const width of DERIVATIVE_WIDTHS) {
    const path = derivativePath(webpPath, width);
    if (!await fileExists(path)) missing.push({ path, resize: { width } });
  }
  if (missing.length === 0) return 0;
  const { pages = 1 } = await sharp(webpPath, { limitInputPixels: MAX_PIXELS }).metadata();
  await writeTargets(webpPath, missing, pages > 1);
  return missing.length;
}
