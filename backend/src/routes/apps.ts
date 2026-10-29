import { Router } from 'express';
import { join } from 'path';
import { unlink, mkdir } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { validParam } from '../middleware/validateParams.js';
import { readJSON, writeJSON, fileExists, appsDir } from '../lib/files.js';
import { withLock } from '../lib/lock.js';
import { isValidSlug, resolveInside } from '../lib/paths.js';
import { applyUpdate, formatErrors, parse, privacyPolicySchema, supportSchema } from '../lib/schemas.js';
import { logger } from '../lib/logger.js';
import { refreshSiteFiles } from '../lib/site.js';

const router = Router();

router.param('id', validParam('app id', isValidSlug));

/** Registers GET/POST/PUT/DELETE for one page type, stored at `data/apps/<id>/<pageType>.json`. */
function pageRoutes(pageType: 'privacy-policy' | 'support', schema: typeof privacyPolicySchema, label: string) {
  const path = `/:id/${pageType}`;
  const fileFor = (id: string) => resolveInside(appsDir, id, `${pageType}.json`);
  const title = `${label[0].toUpperCase()}${label.slice(1)}`;
  const notFound = `${title} not found`;

  router.get(path, async (req, res) => {
    try {
      const filePath = fileFor(req.params.id);
      if (!await fileExists(filePath)) {
        res.status(404).json({ error: notFound });
        return;
      }
      res.json(await readJSON(filePath));
    } catch (err) {
      logger.error(`Failed to fetch ${label} ${req.params.id}: ${err}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post(path, authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      const parsed = parse(schema, req.body, 'create');
      if (!parsed.ok) {
        logger.warn(`Create ${label} ${id} failed: ${parsed.errors.join('; ')}`);
        res.status(400).json({ error: formatErrors(label, parsed.errors) });
        return;
      }
      if (parsed.ignored.length) logger.warn(`Create ${label} ${id}: ignored unknown fields ${parsed.ignored.join(', ')}`);

      await withLock('apps', async () => {
        const filePath = fileFor(id);
        if (await fileExists(filePath)) {
          res.status(409).json({ error: `${title} already exists` });
          return;
        }
        await mkdir(join(filePath, '..'), { recursive: true });
        const page = { ...parsed.value, id };
        await writeJSON(filePath, page);
        logger.info(`Created ${label}: ${id}`);
        await refreshSiteFiles(`Creating ${label} ${id} was saved`);
        res.status(201).json(page);
      });
    } catch (err) {
      logger.error(`Failed to create ${label} ${id}: ${err}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put(path, authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      const parsed = parse(schema, req.body, 'update');
      if (!parsed.ok) {
        logger.warn(`Update ${label} ${id} failed: ${parsed.errors.join('; ')}`);
        res.status(400).json({ error: formatErrors(label, parsed.errors) });
        return;
      }
      if (parsed.ignored.length) logger.warn(`Update ${label} ${id}: ignored unknown fields ${parsed.ignored.join(', ')}`);

      await withLock('apps', async () => {
        const filePath = fileFor(id);
        if (!await fileExists(filePath)) {
          res.status(404).json({ error: notFound });
          return;
        }
        const updated = { ...applyUpdate(await readJSON<object>(filePath), parsed), id };
        await writeJSON(filePath, updated);
        logger.info(`Updated ${label}: ${id}`);
        await refreshSiteFiles(`Updating ${label} ${id} was saved`);
        res.json(updated);
      });
    } catch (err) {
      logger.error(`Failed to update ${label} ${id}: ${err}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete(path, authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      await withLock('apps', async () => {
        const filePath = fileFor(id);
        if (!await fileExists(filePath)) {
          res.status(404).json({ error: notFound });
          return;
        }
        await unlink(filePath);
        logger.info(`Deleted ${label}: ${id}`);
        await refreshSiteFiles(`Deleting ${label} ${id} was saved`);
        res.json({ success: true });
      });
    } catch (err) {
      logger.error(`Failed to delete ${label} ${id}: ${err}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

pageRoutes('privacy-policy', privacyPolicySchema, 'privacy policy');
pageRoutes('support', supportSchema, 'support page');

export default router;
