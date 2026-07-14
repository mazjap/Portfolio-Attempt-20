import { Router, Request, Response } from 'express';
import { join } from 'path';
import { access, unlink, mkdir } from 'fs/promises';
import os from 'os';
import multer from 'multer';
import sharp from 'sharp';
import { authenticate } from '../middleware/auth.js';
import { mediaDir } from '../lib/files.js';
import { logger } from '../lib/logger.js';

const router = Router();

const VALID_CONTEXTS = ['projects', 'posts'] as const;
type MediaContext = (typeof VALID_CONTEXTS)[number];

function isValidContext(value: unknown): value is MediaContext {
  return VALID_CONTEXTS.includes(value as MediaContext);
}

const VALID_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (VALID_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Accepted: JPEG, PNG, WebP, GIF, AVIF, HEIC`));
    }
  },
});

// Wraps multer middleware so errors can be caught in async route handlers
function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

router.post('/upload', authenticate, async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      logger.warn('Upload failed: file exceeds 25MB limit');
      res.status(400).json({ error: 'File exceeds 25MB limit' });
    } else {
      logger.warn(`Upload rejected: ${err}`);
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    }
    return;
  }

  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const context = req.body.context as unknown;
    const id = req.body.id as unknown;
    const overwrite = req.body.overwrite === 'true' || req.body.overwrite === true;

    if (!isValidContext(context)) {
      await unlink(req.file.path);
      logger.warn(`Upload failed: invalid context "${context}"`);
      res.status(400).json({ error: 'context must be "projects" or "posts"' });
      return;
    }

    if (!id || typeof id !== 'string') {
      await unlink(req.file.path);
      logger.warn('Upload failed: missing id');
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const baseName = req.file.originalname.replace(/\.[^.]+$/, '');
    const outputFilename = `${baseName}.webp`;
    const destDir = join(mediaDir, context, id);
    await mkdir(destDir, { recursive: true });
    const destPath = join(destDir, outputFilename);

    if (!overwrite && await fileExists(destPath)) {
      await unlink(req.file.path);
      logger.warn(`Upload rejected: ${context}/${id}/${outputFilename} already exists`);
      res.status(409).json({ error: 'File already exists. Send overwrite: true to replace it.' });
      return;
    }

    await sharp(req.file.path, { animated: req.file.mimetype === 'image/gif' })
      .webp({ quality: 85 })
      .toFile(destPath);

    await unlink(req.file.path);

    logger.info(`Uploaded media: ${context}/${id}/${outputFilename}`);
    res.json({ url: `/media/${context}/${id}/${outputFilename}` });
  } catch (err) {
    if (req.file) await unlink(req.file.path).catch(() => {});
    logger.error(`Failed to upload media: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:context/:id/:filename', authenticate, async (req, res) => {
  try {
    const { context, id, filename } = req.params;
    if (!isValidContext(context)) {
      res.status(400).json({ error: 'context must be "projects" or "posts"' });
      return;
    }
    const filePath = join(mediaDir, context, id, filename);
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    await unlink(filePath);
    logger.info(`Deleted media: ${context}/${id}/${filename}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Failed to delete media ${req.params.context}/${req.params.id}/${req.params.filename}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
