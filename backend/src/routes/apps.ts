import { Router } from 'express';
import { join } from 'path';
import { access, unlink, mkdir } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { readJSON, writeJSON, appsDir } from '../lib/files.js';
import { logger } from '../lib/logger.js';
import type { AppPrivacyPolicy, AppSupport } from '../lib/types.js';

const router = Router();

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ── Privacy Policy ────────────────────────────────────────────────────────────

router.get('/:id/privacy-policy', async (req, res) => {
  try {
    const filePath = join(appsDir, req.params.id, 'privacy-policy.json');
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Privacy policy not found' });
      return;
    }
    logger.info(`Fetched privacy policy: ${req.params.id}`);
    res.json(await readJSON<AppPrivacyPolicy>(filePath));
  } catch (err) {
    logger.error(`Failed to fetch privacy policy ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/privacy-policy', authenticate, async (req, res) => {
  try {
    const appDir = join(appsDir, req.params.id);
    const filePath = join(appDir, 'privacy-policy.json');
    if (await fileExists(filePath)) {
      res.status(409).json({ error: 'Privacy policy already exists' });
      return;
    }
    await mkdir(appDir, { recursive: true });
    const page: AppPrivacyPolicy = { ...req.body, id: req.params.id };
    await writeJSON(filePath, page);
    logger.info(`Created privacy policy: ${req.params.id}`);
    res.status(201).json(page);
  } catch (err) {
    logger.error(`Failed to create privacy policy ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/privacy-policy', authenticate, async (req, res) => {
  try {
    const filePath = join(appsDir, req.params.id, 'privacy-policy.json');
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Privacy policy not found' });
      return;
    }
    const updated: AppPrivacyPolicy = { ...await readJSON<AppPrivacyPolicy>(filePath), ...req.body };
    await writeJSON(filePath, updated);
    logger.info(`Updated privacy policy: ${req.params.id}`);
    res.json(updated);
  } catch (err) {
    logger.error(`Failed to update privacy policy ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/privacy-policy', authenticate, async (req, res) => {
  try {
    const filePath = join(appsDir, req.params.id, 'privacy-policy.json');
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Privacy policy not found' });
      return;
    }
    await unlink(filePath);
    logger.info(`Deleted privacy policy: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Failed to delete privacy policy ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Support ───────────────────────────────────────────────────────────────────

router.get('/:id/support', async (req, res) => {
  try {
    const filePath = join(appsDir, req.params.id, 'support.json');
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Support page not found' });
      return;
    }
    logger.info(`Fetched support page: ${req.params.id}`);
    res.json(await readJSON<AppSupport>(filePath));
  } catch (err) {
    logger.error(`Failed to fetch support page ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/support', authenticate, async (req, res) => {
  try {
    const appDir = join(appsDir, req.params.id);
    const filePath = join(appDir, 'support.json');
    if (await fileExists(filePath)) {
      res.status(409).json({ error: 'Support page already exists' });
      return;
    }
    await mkdir(appDir, { recursive: true });
    const page: AppSupport = { ...req.body, id: req.params.id };
    await writeJSON(filePath, page);
    logger.info(`Created support page: ${req.params.id}`);
    res.status(201).json(page);
  } catch (err) {
    logger.error(`Failed to create support page ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/support', authenticate, async (req, res) => {
  try {
    const filePath = join(appsDir, req.params.id, 'support.json');
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Support page not found' });
      return;
    }
    const updated: AppSupport = { ...await readJSON<AppSupport>(filePath), ...req.body };
    await writeJSON(filePath, updated);
    logger.info(`Updated support page: ${req.params.id}`);
    res.json(updated);
  } catch (err) {
    logger.error(`Failed to update support page ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/support', authenticate, async (req, res) => {
  try {
    const filePath = join(appsDir, req.params.id, 'support.json');
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Support page not found' });
      return;
    }
    await unlink(filePath);
    logger.info(`Deleted support page: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Failed to delete support page ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
