import { createHash, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

// Compares hashes so the comparison takes the same time whatever the token's length or contents.
function tokenMatches(token: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(token), digest(secret));
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    logger.warn(`Auth failed (no token): ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  if (!tokenMatches(token, process.env.API_SECRET)) {
    logger.warn(`Auth failed (bad token): ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
