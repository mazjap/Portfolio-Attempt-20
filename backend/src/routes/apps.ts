import { Router } from 'express';
import { join } from 'path';
import { unlink, mkdir, readdir } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { validParam } from '../middleware/validateParams.js';
import { readJSON, writeJSON, fileExists, appsDir } from '../lib/files.js';
import { withLock } from '../lib/lock.js';
import { isValidSlug, resolveInside } from '../lib/paths.js';
import { applyUpdate, formatErrors, parse, privacyPolicySchema, supportSchema } from '../lib/schemas.js';
import { logger } from '../lib/logger.js';
import { refreshSiteFiles } from '../lib/site.js';
import type { AppPageType, AppSummary } from '../lib/types.js';
import { expectedVersion, isRepeatedCreate, isStale, staleMessage } from '../lib/versions.js';

const router = Router();

router.param('id', validParam('app id', isValidSlug));

const PAGE_TYPES: AppPageType[] = ['privacy-policy', 'support'];

/** Every app with at least one page, sorted by ID. Apps aren't indexed, so this reads the folders. */
router.get('/', async (_req, res) => {
  try {
    const apps: AppSummary[] = [];
    const entries = await readdir(appsDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || !isValidSlug(entry.name)) continue;
      const pages: AppPageType[] = [];
      let appName: string | undefined;
      for (const page of PAGE_TYPES) {
        const filePath = resolveInside(appsDir, entry.name, `${page}.json`);
        if (!await fileExists(filePath)) continue;
        pages.push(page);
        if (appName) continue;
        try {
          const name = (await readJSON<{ appName?: unknown }>(filePath)).appName;
          if (typeof name === 'string' && name.trim()) appName = name;
        } catch (err) {
          logger.warn(`apps/${entry.name}/${page}.json can't be read: ${err}`);
        }
      }
      if (pages.length) apps.push({ id: entry.name, appName: appName ?? entry.name, pages });
    }
    res.json(apps);
  } catch (err) {
    logger.error(`Failed to list apps: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Registers GET/POST/PUT/DELETE for one page type, stored at `data/apps/<id>/<pageType>.json`. */
function pageRoutes(pageType: AppPageType, schema: typeof privacyPolicySchema, label: string) {
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
          // A retry of a create whose response was lost gets the page it made, not a 409.
          const existing = await readJSON<object>(filePath).catch(() => null);
          if (isRepeatedCreate(Object.keys(schema), parsed.value, req.body, existing)) {
            logger.info(`Create ${label} ${id}: repeated an earlier identical create; returned the stored page`);
            res.status(200).json(existing);
            return;
          }
          res.status(409).json({ error: `${title} already exists` });
          return;
        }
        await mkdir(join(filePath, '..'), { recursive: true });
        const page = { ...parsed.value, id, updatedAt: new Date().toISOString() };
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
      const expected = expectedVersion(req);
      if (!expected.ok) {
        res.status(400).json({ error: expected.error });
        return;
      }
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
        const existing = await readJSON<object>(filePath);
        if (isStale(expected.version, existing)) {
          logger.warn(`Update ${label} ${id} refused: it changed after ${expected.version}`);
          res.status(409).json({ error: staleMessage(label, existing), current: existing });
          return;
        }
        const updated = { ...applyUpdate(existing, parsed), id, updatedAt: new Date().toISOString() };
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
      const expected = expectedVersion(req);
      if (!expected.ok) {
        res.status(400).json({ error: expected.error });
        return;
      }
      await withLock('apps', async () => {
        const filePath = fileFor(id);
        if (!await fileExists(filePath)) {
          res.status(404).json({ error: notFound });
          return;
        }
        if (expected.version !== null) {
          const existing = await readJSON<object>(filePath);
          if (isStale(expected.version, existing)) {
            logger.warn(`Delete ${label} ${id} refused: it changed after ${expected.version}`);
            res.status(409).json({ error: staleMessage(label, existing), current: existing });
            return;
          }
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
