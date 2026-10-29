import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';
import postsRouter from './routes/posts.js';
import mediaRouter from './routes/media.js';
import appsRouter from './routes/apps.js';
import { mediaDir } from './lib/files.js';
import { logger } from './lib/logger.js';
import { storageIsWritable } from './lib/bootstrap.js';
import { CorsRejectedError, errorHandler, JSON_BODY_LIMIT, notFound } from './middleware/errors.js';

export const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter((o): o is string => Boolean(o));

/** Builds the Express app without starting it (index.ts listens; tests use it directly). */
export function createApp(): express.Express {
  const app = express();

  // First, so requests rejected by CORS or the body parser are logged too.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const msg = `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`;
      res.statusCode >= 500 ? logger.error(msg) : logger.info(msg);
    });
    next();
  });

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new CorsRejectedError(`Origin not allowed: ${origin}`));
      }
    },
  }));

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', async (_req, res) => {
    const writable = await storageIsWritable();
    res.status(writable ? 200 : 503).json({ status: writable ? 'ok' : 'storage unavailable' });
  });

  app.use('/media', express.static(mediaDir));
  app.use('/api/projects', projectsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/apps', appsRouter);
  app.use('/api/media', mediaRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
