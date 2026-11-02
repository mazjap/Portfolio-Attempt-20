// Conditional writes and safe create retries (see "Conditional writes" and "Retrying a create" in
// DEVDOC.md).
//
// A record's version is its `updatedAt`, or its `createdAt` if it has never been updated (app pages
// have no `createdAt`, so one that was never saved by this server has no version). A client that
// sends `X-Expected-Version: <the version it loaded>` on PUT or DELETE gets 409 with the current
// record if the record has changed since. Without the header, writes are unconditional.
import type { Request } from 'express';
import { isDeepStrictEqual } from 'util';
import { isDateTime } from './schemas.js';

export const VERSION_HEADER = 'X-Expected-Version';

export type ExpectedVersion = { ok: true; version: string | null } | { ok: false; error: string };

/** The version the client says its edit is based on: `null` when it didn't send one. */
export function expectedVersion(req: Request): ExpectedVersion {
  const value = req.get(VERSION_HEADER)?.trim();
  if (value === undefined || value === '') return { ok: true, version: null };
  if (!isDateTime(value)) return { ok: false, error: `${VERSION_HEADER} must be the ISO 8601 updatedAt (or createdAt) the edit started from` };
  return { ok: true, version: value };
}

export function recordVersion(record: unknown): string | null {
  if (typeof record !== 'object' || record === null) return null;
  const { updatedAt, createdAt } = record as { updatedAt?: unknown; createdAt?: unknown };
  if (typeof updatedAt === 'string') return updatedAt;
  if (typeof createdAt === 'string') return createdAt;
  return null;
}

/**
 * Whether a write based on `expected` would overwrite a change the client hasn't seen. Clients may
 * drop fractional seconds (Swift's `.iso8601` coding strategy does), so an `expected` without them is
 * compared to the second (`…T12:00:00Z` matches a stored `…T12:00:00.123Z`); one with them is
 * compared to the millisecond.
 */
export function isStale(expected: string | null, record: unknown): boolean {
  if (expected === null) return false;
  const current = recordVersion(record);
  if (current === null) return true;
  const precise = /T\d{2}:\d{2}:\d{2}\.\d/.test(expected);
  const unit = precise ? 1 : 1000;
  return Math.floor(Date.parse(current) / unit) !== Math.floor(Date.parse(expected) / unit);
}

export function staleMessage(what: string, record: unknown): string {
  const current = recordVersion(record);
  return `This ${what} was changed on the server${current ? ` (at ${current})` : ''} after you opened it. Reload it to see the current version.`;
}

/**
 * Whether a create request repeats the one that made `stored`, as when a client retries a create
 * whose response was lost. Every schema field must match what this request would store (`created`,
 * defaults included), except `createdAt` when the request left it out, since its default is "now".
 */
export function isRepeatedCreate(fields: Iterable<string>, created: Record<string, unknown>, body: Record<string, unknown>, stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null) return false;
  const record = stored as Record<string, unknown>;
  for (const key of fields) {
    if (key === 'createdAt' && body.createdAt === undefined) continue;
    if (!isDeepStrictEqual(record[key], created[key])) return false;
  }
  return true;
}
