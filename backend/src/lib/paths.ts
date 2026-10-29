import { resolve, sep } from 'path';

// Matches Folio's `String.slugified`: lowercase ASCII letters and digits, single hyphens between them.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 100;

// Generated projection files that live beside the content records.
const RESERVED_IDS = new Set(['index', 'nav']);

const MEDIA_EXTENSIONS = new Set(['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif']);

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && SLUG.test(value);
}

/** A slug that can name a project or post file without colliding with `index.json`/`nav.json`. */
export function isValidContentId(value: unknown): value is string {
  return isValidSlug(value) && !RESERVED_IDS.has(value);
}

/**
 * A single media filename with an image extension: no path separators, control characters, or leading
 * dot (so no `..` and no hidden temp files). Spaces and other characters are allowed because files
 * uploaded before names were sanitized have them (`1. Launch.webp`); `resolveInside` still guards the path.
 */
export function isValidMediaFilename(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 255) return false;
  if (value.startsWith('.') || /[/\\\u0000-\u001f\u007f]/.test(value)) return false;
  const ext = value.slice(value.lastIndexOf('.') + 1).toLowerCase();
  return value.includes('.') && MEDIA_EXTENSIONS.has(ext);
}

/**
 * Turns an uploaded file's original name into a URL-safe base name (no extension), keeping case so
 * existing names like `4D7E28F0-….webp` are unchanged. Returns null if nothing usable is left.
 */
export function safeMediaBaseName(originalName: string): string | null {
  const base = originalName
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 150);
  return base || null;
}

export class PathEscapeError extends Error {}

/** Resolves `segments` under `root`, throwing if the result would land outside it. */
export function resolveInside(root: string, ...segments: string[]): string {
  const base = resolve(root);
  const target = resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new PathEscapeError(`Path escapes ${base}: ${segments.join('/')}`);
  }
  return target;
}
