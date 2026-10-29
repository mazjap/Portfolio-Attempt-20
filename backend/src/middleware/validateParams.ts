import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * A `router.param` handler that rejects route parameters failing `isValid` before any route
 * touches the filesystem. Public reads get 404 (there's no such content); writes get 400.
 */
export function validParam(name: string, isValid: (value: unknown) => boolean) {
  return (req: Request, res: Response, next: NextFunction, value: unknown): void => {
    if (isValid(value)) {
      next();
      return;
    }
    logger.warn(`Rejected invalid ${name}: ${req.method} ${req.originalUrl}`);
    if (req.method === 'GET') {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(400).json({ error: `Invalid ${name}` });
    }
  };
}
