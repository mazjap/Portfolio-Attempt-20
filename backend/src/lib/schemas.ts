// Runtime validation for request bodies and stored records. TypeScript types don't check JSON from
// the network or the disk, so every write goes through these before it's saved.
//
// Write semantics (Folio depends on them):
// - PUT is a merge: omitted fields keep their stored values, and `null` clears an optional field.
// - `createdAt` is editable (so content can be backdated). `id`, `updatedAt`, and `readingTime` are
//   owned by the server and ignored if sent, as are unknown fields.

type Rule =
  | { kind: 'string'; max: number; nonEmpty?: boolean }
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'dateTime' }
  | { kind: 'date' }
  | { kind: 'url'; allowEmpty?: boolean; schemes: readonly string[] }
  | { kind: 'stringArray'; maxItems: number; maxLength: number }
  | { kind: 'links' }
  | { kind: 'media' };

interface Field {
  rule: Rule;
  /** Must be present on create. */
  required?: boolean;
  /** Optional field that `null` clears on update. */
  clearable?: boolean;
  /** Filled in on create when omitted. */
  fallback?: () => unknown;
}

type Schema = Record<string, Field>;

export type ParseResult =
  | { ok: true; value: Record<string, unknown>; cleared: string[]; ignored: string[] }
  | { ok: false; errors: string[] };

const MAX_MARKDOWN = 500_000;
const WEB = ['http:', 'https:'] as const;
const WEB_OR_MAIL = ['http:', 'https:', 'mailto:'] as const;

export const PROJECT_STATUSES = ['active', 'in-progress', 'archived'] as const;

const markdown = (): Rule => ({ kind: 'string', max: MAX_MARKDOWN });
const emptyString = () => '';
const emptyArray = () => [];

export const projectSchema: Schema = {
  title: { rule: { kind: 'string', max: 200, nonEmpty: true }, required: true },
  tagline: { rule: { kind: 'string', max: 300, nonEmpty: true }, required: true },
  status: { rule: { kind: 'enum', values: PROJECT_STATUSES }, required: true },
  description: { rule: markdown(), fallback: emptyString },
  heroImage: { rule: { kind: 'url', allowEmpty: true, schemes: WEB }, fallback: emptyString },
  category: { rule: { kind: 'string', max: 50 }, clearable: true },
  featured: { rule: { kind: 'boolean' }, fallback: () => false },
  techStack: { rule: { kind: 'stringArray', maxItems: 50, maxLength: 60 }, fallback: emptyArray },
  links: { rule: { kind: 'links' }, fallback: () => ({}) },
  media: { rule: { kind: 'media' }, fallback: emptyArray },
  createdAt: { rule: { kind: 'dateTime' }, fallback: () => new Date().toISOString() },
};

export const postSchema: Schema = {
  title: { rule: { kind: 'string', max: 200, nonEmpty: true }, required: true },
  excerpt: { rule: { kind: 'string', max: 1000 }, fallback: emptyString },
  content: { rule: markdown(), fallback: emptyString },
  heroImage: { rule: { kind: 'url', allowEmpty: true, schemes: WEB }, clearable: true },
  tags: { rule: { kind: 'stringArray', maxItems: 30, maxLength: 40 }, fallback: emptyArray },
  series: { rule: { kind: 'string', max: 100 }, clearable: true },
  createdAt: { rule: { kind: 'dateTime' }, fallback: () => new Date().toISOString() },
};

const contactFields: Schema = {
  contactUrl: { rule: { kind: 'url', allowEmpty: true, schemes: WEB_OR_MAIL }, clearable: true },
  contactText: { rule: { kind: 'string', max: 100 }, clearable: true },
};

export const privacyPolicySchema: Schema = {
  appName: { rule: { kind: 'string', max: 100, nonEmpty: true }, required: true },
  lastUpdated: { rule: { kind: 'date' }, required: true },
  content: { rule: markdown(), required: true },
  ...contactFields,
};

export const supportSchema: Schema = {
  appName: { rule: { kind: 'string', max: 100, nonEmpty: true }, required: true },
  version: { rule: { kind: 'string', max: 30 }, required: true },
  subtitle: { rule: { kind: 'string', max: 300 }, fallback: emptyString },
  content: { rule: markdown(), required: true },
  ...contactFields,
};

/** Fields the server sets itself; sending them isn't an error, they're just ignored. */
const SERVER_OWNED = new Set(['id', 'updatedAt', 'readingTime']);

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCalendarDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * A site-relative path (`/media/…`) or an absolute URL with one of `schemes`. Paths may contain spaces
 * and non-ASCII characters: media uploaded before filenames were sanitized have names like
 * `/media/projects/trekpoint/1. Launch.webp`, and browsers encode them when requesting.
 */
function isAllowedUrl(value: string, schemes: readonly string[]): boolean {
  if (value.startsWith('/')) return !value.startsWith('//') && !/[\u0000-\u001f\u007f]/.test(value);
  try {
    return schemes.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function check(name: string, rule: Rule, value: unknown): string | null {
  switch (rule.kind) {
    case 'string':
      if (typeof value !== 'string') return `${name} must be a string`;
      if (rule.nonEmpty && value.trim() === '') return `${name} can't be empty`;
      if (value.length > rule.max) return `${name} must be at most ${rule.max} characters`;
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${name} must be true or false`;
    case 'enum':
      return typeof value === 'string' && rule.values.includes(value)
        ? null
        : `${name} must be one of: ${rule.values.join(', ')}`;
    case 'dateTime':
      return typeof value === 'string' && DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))
        ? null
        : `${name} must be an ISO 8601 date and time, like 2025-01-31T12:00:00Z`;
    case 'date':
      return typeof value === 'string' && DATE.test(value) && isValidCalendarDate(value)
        ? null
        : `${name} must be a date like 2025-01-31`;
    case 'url':
      if (typeof value !== 'string') return `${name} must be a string`;
      if (value === '') return rule.allowEmpty ? null : `${name} can't be empty`;
      if (value.length > 2000) return `${name} must be at most 2000 characters`;
      return isAllowedUrl(value, rule.schemes)
        ? null
        : `${name} must be a path starting with / or a ${rule.schemes.map(s => s.slice(0, -1)).join('/')} URL`;
    case 'stringArray': {
      if (!Array.isArray(value)) return `${name} must be an array of strings`;
      if (value.length > rule.maxItems) return `${name} can have at most ${rule.maxItems} items`;
      const bad = value.findIndex(v => typeof v !== 'string' || v.trim() === '' || v.length > rule.maxLength);
      return bad === -1 ? null : `${name}[${bad}] must be a non-empty string of at most ${rule.maxLength} characters`;
    }
    case 'links': {
      if (!isPlainObject(value)) return `${name} must be an object of label → URL`;
      const entries = Object.entries(value);
      if (entries.length > 20) return `${name} can have at most 20 links`;
      for (const [label, url] of entries) {
        if (label.trim() === '' || label.length > 50) return `${name} labels must be 1–50 characters`;
        if (typeof url !== 'string' || !isAllowedUrl(url, WEB_OR_MAIL)) {
          return `${name}["${label}"] must be an http, https, or mailto URL`;
        }
      }
      return null;
    }
    case 'media': {
      if (!Array.isArray(value)) return `${name} must be an array`;
      if (value.length > 100) return `${name} can have at most 100 items`;
      for (const [i, item] of value.entries()) {
        if (!isPlainObject(item)) return `${name}[${i}] must be an object`;
        if (item.type !== 'image' && item.type !== 'video') return `${name}[${i}].type must be image or video`;
        if (typeof item.url !== 'string' || !isAllowedUrl(item.url, WEB)) {
          return `${name}[${i}].url must be a path starting with / or an http/https URL`;
        }
        if (item.caption !== undefined && (typeof item.caption !== 'string' || item.caption.length > 300)) {
          return `${name}[${i}].caption must be a string of at most 300 characters`;
        }
      }
      return null;
    }
  }
}

/**
 * Validates `body` against `schema`.
 * - `create`: required fields must be present, and missing fields with a fallback are filled in.
 * - `update`: every field is optional, and `null` on a clearable field is returned in `cleared`.
 * - `stored`: like create, but nothing is filled in (for checking records already on disk).
 */
export function parse(schema: Schema, body: unknown, mode: 'create' | 'update' | 'stored'): ParseResult {
  if (!isPlainObject(body)) return { ok: false, errors: ['body must be a JSON object'] };

  const errors: string[] = [];
  const value: Record<string, unknown> = {};
  const cleared: string[] = [];
  const ignored: string[] = [];
  const present = new Set<string>();

  for (const [key, raw] of Object.entries(body)) {
    const field = schema[key];
    if (!field) {
      if (!SERVER_OWNED.has(key)) ignored.push(key);
      continue;
    }
    present.add(key);
    if (raw === null || raw === undefined) {
      if (field.clearable) {
        if (mode === 'update') cleared.push(key);
      } else {
        errors.push(`${key} can't be null`);
      }
      continue;
    }
    const error = check(key, field.rule, raw);
    if (error) errors.push(error);
    else value[key] = raw;
  }

  if (mode !== 'update') {
    for (const [key, field] of Object.entries(schema)) {
      if (present.has(key) && !(field.clearable && body[key] === null)) continue;
      if (field.required) errors.push(`${key} is required`);
      else if (field.fallback && mode === 'create') value[key] = field.fallback();
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value, cleared, ignored };
}

/** Applies a validated update to a stored record: merges values, deletes cleared fields. */
export function applyUpdate<T extends object>(existing: T, update: { value: Record<string, unknown>; cleared: string[] }): T {
  const merged: Record<string, unknown> = { ...existing, ...update.value };
  for (const key of update.cleared) delete merged[key];
  return merged as T;
}

export function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 200);
}

/**
 * Why a stored record can't be listed, judged only on the fields the index and nav files (and the
 * list views) use. A record with other problems is still listed; `npm run check` reports those.
 */
export function listingProblems(kind: 'projects' | 'posts', record: unknown): string[] {
  if (!isPlainObject(record)) return ['not a JSON object'];
  const problems: string[] = [];
  const string = (key: string) => {
    if (typeof record[key] !== 'string') problems.push(`${key} must be a string`);
  };
  string('title');
  string('createdAt');
  if (kind === 'projects') {
    string('tagline');
    if (!PROJECT_STATUSES.includes(record.status as never)) problems.push(`status must be one of: ${PROJECT_STATUSES.join(', ')}`);
    if (record.featured !== undefined && typeof record.featured !== 'boolean') problems.push('featured must be true or false');
  } else {
    if (!Array.isArray(record.tags) || record.tags.some(t => typeof t !== 'string')) problems.push('tags must be an array of strings');
    if (typeof record.readingTime !== 'number') problems.push('readingTime must be a number');
  }
  return problems;
}

export function formatErrors(what: string, errors: string[]): string {
  return `Invalid ${what}: ${errors.join('; ')}`;
}
