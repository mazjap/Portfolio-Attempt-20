import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';
import postsRouter from './routes/posts.js';
import mediaRouter from './routes/media.js';
import appsRouter from './routes/apps.js';
import { mediaDir } from './lib/files.js';
import { logger } from './lib/logger.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter((o): o is string => Boolean(o));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const msg = `${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`;
    res.statusCode >= 500 ? logger.error(msg) : logger.info(msg);
  });
  next();
});

app.use('/media', express.static(mediaDir));
app.use('/api/projects', projectsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/apps', appsRouter);
app.use('/api/media', mediaRouter);

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info(`Media dir: ${mediaDir}`);
});
