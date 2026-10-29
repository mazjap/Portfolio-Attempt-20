import { Router, Request, Response } from 'express';
import { unlink, mkdir } from 'fs/promises';
import os from 'os';
import multer from 'multer';
import sharp, { type Metadata } from 'sharp';
import { authenticate } from '../middleware/auth.js';
import { validParam } from '../middleware/validateParams.js';
import { fileExists, mediaDir } from '../lib/files.js';
import { derivativePaths, isDerivative, MAX_PIXELS, writeImageSet } from '../lib/images.js';
import { withLock } from '../lib/lock.js';
import { isValidContentId, isValidMediaFilename, resolveInside, safeMediaBaseName } from '../lib/paths.js';
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

// Formats sharp reports for files it can decode. AVIF is reported as `heif` with AV1 compression;
// HEIC (`heif` with HEVC compression) needs a decoder that prebuilt sharp binaries don't include.
const DECODABLE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif']);
const MAX_FRAMES = 500;

type Inspection =
  | { ok: true; animated: boolean }
  | { ok: false; status: number; error: string };

/** Checks what the file actually is, rather than trusting the MIME type the client sent. */
async function inspect(path: string): Promise<Inspection> {
  let meta: Metadata;
  try {
    meta = await sharp(path, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    return { ok: false, status: 400, error: "The file isn't a readable image" };
  }
  if (meta.format === 'heif' && meta.compression !== 'av1') {
    return { ok: false, status: 415, error: "HEIC images can't be converted on this server. Convert to JPEG or PNG before uploading." };
  }
  if (!meta.format || !DECODABLE_FORMATS.has(meta.format)) {
    return { ok: false, status: 415, error: `Unsupported image format: ${meta.format ?? 'unknown'}` };
  }
  const pages = meta.pages ?? 1;
  if (pages > MAX_FRAMES) return { ok: false, status: 400, error: `Animations can have at most ${MAX_FRAMES} frames` };
  if ((meta.width ?? 0) * (meta.pageHeight ?? meta.height ?? 0) > MAX_PIXELS) {
    return { ok: false, status: 400, error: 'Image dimensions are too large' };
  }
  return { ok: true, animated: pages > 1 && (meta.format === 'gif' || meta.format === 'webp') };
}

router.param('id', validParam('id', isValidContentId));
router.param('filename', validParam('filename', isValidMediaFilename));

const upload = multer({
  dest: os.tmpdir(),
  // Clients (curl, URLSession) send filenames as raw UTF-8; busboy's default would read them as latin1.
  defParamCharset: 'utf8',
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

    if (!isValidContentId(id)) {
      await unlink(req.file.path);
      logger.warn(`Upload failed: invalid id ${JSON.stringify(id)}`);
      res.status(400).json({ error: 'id must be the lowercase slug of a project or post' });
      return;
    }

    const baseName = safeMediaBaseName(req.file.originalname);
    if (!baseName) {
      await unlink(req.file.path);
      logger.warn(`Upload failed: unusable filename ${JSON.stringify(req.file.originalname)}`);
      res.status(400).json({ error: 'Filename must contain letters or digits' });
      return;
    }
    const outputFilename = `${baseName}.webp`;
    const destDir = resolveInside(mediaDir, context, id);
    const destPath = resolveInside(destDir, outputFilename);
    const uploadPath = req.file.path;

    const inspection = await inspect(uploadPath);
    if (!inspection.ok) {
      await unlink(uploadPath);
      logger.warn(`Upload rejected (${req.file.originalname}): ${inspection.error}`);
      res.status(inspection.status).json({ error: inspection.error });
      return;
    }

    // One conversion at a time: bounds CPU and memory, and makes the exists-check and write atomic.
    await withLock('media', async () => {
      await mkdir(destDir, { recursive: true });
      if (!overwrite && await fileExists(destPath)) {
        await unlink(uploadPath);
        logger.warn(`Upload rejected: ${context}/${id}/${outputFilename} already exists`);
        res.status(409).json({ error: 'File already exists. Send overwrite: true to replace it.' });
        return;
      }

      // Main image (at most 2560 px) plus 640/1280 px widths, staged and renamed into place, so a
      // failed conversion never replaces a good file.
      await writeImageSet(uploadPath, destPath, inspection.animated);
      await unlink(uploadPath);

      logger.info(`Uploaded media: ${context}/${id}/${outputFilename}`);
      res.json({ url: `/media/${context}/${id}/${outputFilename}` });
    });
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
    const filePath = resolveInside(mediaDir, context, id, filename);
    await withLock('media', async () => {
      if (!await fileExists(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      await unlink(filePath);
      // Deleting an image also deletes its smaller widths.
      if (!isDerivative(filePath)) {
        await Promise.all(derivativePaths(filePath).map(p => unlink(p).catch(() => {})));
      }
      logger.info(`Deleted media: ${context}/${id}/${filename}`);
      res.json({ success: true });
    });
  } catch (err) {
    logger.error(`Failed to delete media ${req.params.context}/${req.params.id}/${req.params.filename}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
