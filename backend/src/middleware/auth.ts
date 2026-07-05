import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    logger.warn(`Auth failed (no token): ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  if (token !== process.env.API_SECRET) {
    logger.warn(`Auth failed (bad token): ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
