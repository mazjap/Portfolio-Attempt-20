import { Router } from 'express';
import { join } from 'path';
import { access, unlink } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { readJSON, writeJSON, projectsDir } from '../lib/files.js';
import { regenerateProjects } from '../lib/regenerate.js';
import { logger } from '../lib/logger.js';
import type { ProjectDetail, ProjectPreview, ProjectNav } from '../lib/types.js';

const router = Router();

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

router.get('/', async (_req, res) => {
  try {
    const index = await readJSON<ProjectPreview[]>(join(projectsDir, 'index.json'));
    logger.info('Listed projects');
    res.json(index);
  } catch (err) {
    logger.error(`Failed to list projects: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nav', async (_req, res) => {
  try {
    const nav = await readJSON<ProjectNav[]>(join(projectsDir, 'nav.json'));
    logger.info('Listed projects nav');
    res.json(nav);
  } catch (err) {
    logger.error(`Failed to list projects nav: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const filePath = join(projectsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      logger.warn(`Project not found: ${req.params.id}`);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const project = await readJSON<ProjectDetail>(filePath);
    logger.info(`Fetched project: ${req.params.id}`);
    res.json(project);
  } catch (err) {
    logger.error(`Failed to fetch project ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const project = req.body as ProjectDetail;
    if (!project.id || !project.tagline) {
      logger.warn('Create project failed: missing id or tagline');
      res.status(400).json({ error: 'id and tagline are required' });
      return;
    }
    const filePath = join(projectsDir, `${project.id}.json`);
    if (await fileExists(filePath)) {
      logger.warn(`Create project failed: ${project.id} already exists`);
      res.status(409).json({ error: 'Project already exists' });
      return;
    }
    project.createdAt ??= new Date().toISOString();
    await writeJSON(filePath, project);
    await regenerateProjects();
    logger.info(`Created project: ${project.id}`);
    res.status(201).json(project);
  } catch (err) {
    logger.error(`Failed to create project: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const filePath = join(projectsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      logger.warn(`Update project failed: ${req.params.id} not found`);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const existing = await readJSON<ProjectDetail>(filePath);
    const updated: ProjectDetail = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await writeJSON(filePath, updated);
    await regenerateProjects();
    logger.info(`Updated project: ${req.params.id}`);
    res.json(updated);
  } catch (err) {
    logger.error(`Failed to update project ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const filePath = join(projectsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      logger.warn(`Delete project failed: ${req.params.id} not found`);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    await unlink(filePath);
    await regenerateProjects();
    logger.info(`Deleted project: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Failed to delete project ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
