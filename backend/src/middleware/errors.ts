import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { PathEscapeError } from '../lib/paths.js';

export const JSON_BODY_LIMIT = '1mb';

export class CorsRejectedError extends Error {}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

/** JSON 404 for anything no route handled. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

/** Turns every error into a JSON response without a stack trace. Server errors are logged with theirs. */
export function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof CorsRejectedError) {
    logger.warn(`CORS rejected origin ${req.headers.origin}: ${req.method} ${req.originalUrl}`);
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  if (err instanceof PathEscapeError) {
    logger.warn(`${err.message}: ${req.method} ${req.originalUrl}`);
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    const message =
      err.type === 'entity.parse.failed' ? 'Malformed JSON body' :
      err.type === 'entity.too.large' ? `Request body is larger than the ${JSON_BODY_LIMIT} limit` :
      err.expose ? err.message : 'Bad request';
    logger.warn(`${req.method} ${req.originalUrl} → ${status}: ${message}`);
    res.status(status).json({ error: message });
    return;
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.stack ?? err}`);
  res.status(500).json({ error: 'Internal server error' });
}
