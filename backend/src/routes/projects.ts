import { Router } from 'express';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { validParam } from '../middleware/validateParams.js';
import { readJSON, writeJSON, fileExists, projectsDir } from '../lib/files.js';
import { withLock } from '../lib/lock.js';
import { isValidContentId, resolveInside } from '../lib/paths.js';
import { regenerateProjects } from '../lib/regenerate.js';
import { applyUpdate, formatErrors, parse, projectSchema } from '../lib/schemas.js';
import { logger } from '../lib/logger.js';
import { refreshSiteFiles } from '../lib/site.js';
import type { ProjectDetail, ProjectPreview, ProjectNav } from '../lib/types.js';

const router = Router();

router.param('id', validParam('id', isValidContentId));

/** Regenerates the index, nav, and site files after a write that has already been saved. A failure here doesn't undo the save, so it's logged rather than reported as a failed request. */
async function regenerateAfterWrite(action: string): Promise<void> {
  try {
    await regenerateProjects();
  } catch (err) {
    logger.error(`${action} was saved, but regenerating the projects index failed (run npm run regen): ${err}`);
  }
  await refreshSiteFiles(`${action} was saved`);
}

router.get('/', async (_req, res) => {
  try {
    res.json(await readJSON<ProjectPreview[]>(join(projectsDir, 'index.json')));
  } catch (err) {
    logger.error(`Failed to list projects: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nav', async (_req, res) => {
  try {
    res.json(await readJSON<ProjectNav[]>(join(projectsDir, 'nav.json')));
  } catch (err) {
    logger.error(`Failed to list projects nav: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const filePath = resolveInside(projectsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(await readJSON<ProjectDetail>(filePath));
  } catch (err) {
    logger.error(`Failed to fetch project ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const id = (req.body as { id?: unknown } | undefined)?.id;
    if (!isValidContentId(id)) {
      logger.warn(`Create project failed: invalid id ${JSON.stringify(id)}`);
      res.status(400).json({ error: 'id is required and must be a lowercase slug (letters, digits, hyphens) other than "index" or "nav"' });
      return;
    }
    const parsed = parse(projectSchema, req.body, 'create');
    if (!parsed.ok) {
      logger.warn(`Create project ${id} failed: ${parsed.errors.join('; ')}`);
      res.status(400).json({ error: formatErrors('project', parsed.errors) });
      return;
    }
    if (parsed.ignored.length) logger.warn(`Create project ${id}: ignored unknown fields ${parsed.ignored.join(', ')}`);

    await withLock('projects', async () => {
      const filePath = resolveInside(projectsDir, `${id}.json`);
      if (await fileExists(filePath)) {
        logger.warn(`Create project failed: ${id} already exists`);
        res.status(409).json({ error: 'Project already exists' });
        return;
      }
      const project = { id, ...parsed.value } as ProjectDetail;
      await writeJSON(filePath, project);
      await regenerateAfterWrite(`Creating project ${id}`);
      logger.info(`Created project: ${id}`);
      res.status(201).json(project);
    });
  } catch (err) {
    logger.error(`Failed to create project: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const parsed = parse(projectSchema, req.body, 'update');
    if (!parsed.ok) {
      logger.warn(`Update project ${id} failed: ${parsed.errors.join('; ')}`);
      res.status(400).json({ error: formatErrors('project', parsed.errors) });
      return;
    }
    if (parsed.ignored.length) logger.warn(`Update project ${id}: ignored unknown fields ${parsed.ignored.join(', ')}`);

    await withLock('projects', async () => {
      const filePath = resolveInside(projectsDir, `${id}.json`);
      if (!await fileExists(filePath)) {
        logger.warn(`Update project failed: ${id} not found`);
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const existing = await readJSON<ProjectDetail>(filePath);
      const updated = { ...applyUpdate(existing, parsed), id, updatedAt: new Date().toISOString() };
      await writeJSON(filePath, updated);
      await regenerateAfterWrite(`Updating project ${id}`);
      logger.info(`Updated project: ${id}`);
      res.json(updated);
    });
  } catch (err) {
    logger.error(`Failed to update project ${id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await withLock('projects', async () => {
      const filePath = resolveInside(projectsDir, `${id}.json`);
      if (!await fileExists(filePath)) {
        logger.warn(`Delete project failed: ${id} not found`);
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      await unlink(filePath);
      await regenerateAfterWrite(`Deleting project ${id}`);
      logger.info(`Deleted project: ${id}`);
      res.json({ success: true });
    });
  } catch (err) {
    logger.error(`Failed to delete project ${id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
