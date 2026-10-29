import { Router } from 'express';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { validParam } from '../middleware/validateParams.js';
import { readJSON, writeJSON, fileExists, postsDir } from '../lib/files.js';
import { withLock } from '../lib/lock.js';
import { isValidContentId, resolveInside } from '../lib/paths.js';
import { regeneratePosts } from '../lib/regenerate.js';
import { applyUpdate, calculateReadingTime, formatErrors, parse, postSchema } from '../lib/schemas.js';
import { logger } from '../lib/logger.js';
import { refreshSiteFiles } from '../lib/site.js';
import type { PostDetail, PostPreview, PostNav } from '../lib/types.js';

const router = Router();

router.param('id', validParam('id', isValidContentId));

/** Regenerates the index, nav, and site files after a write that has already been saved. A failure here doesn't undo the save, so it's logged rather than reported as a failed request. */
async function regenerateAfterWrite(action: string): Promise<void> {
  try {
    await regeneratePosts();
  } catch (err) {
    logger.error(`${action} was saved, but regenerating the posts index failed (run npm run regen): ${err}`);
  }
  await refreshSiteFiles(`${action} was saved`);
}

router.get('/', async (_req, res) => {
  try {
    res.json(await readJSON<PostPreview[]>(join(postsDir, 'index.json')));
  } catch (err) {
    logger.error(`Failed to list posts: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nav', async (_req, res) => {
  try {
    res.json(await readJSON<PostNav[]>(join(postsDir, 'nav.json')));
  } catch (err) {
    logger.error(`Failed to list posts nav: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const filePath = resolveInside(postsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(await readJSON<PostDetail>(filePath));
  } catch (err) {
    logger.error(`Failed to fetch post ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const id = (req.body as { id?: unknown } | undefined)?.id;
    if (!isValidContentId(id)) {
      logger.warn(`Create post failed: invalid id ${JSON.stringify(id)}`);
      res.status(400).json({ error: 'id is required and must be a lowercase slug (letters, digits, hyphens) other than "index" or "nav"' });
      return;
    }
    const parsed = parse(postSchema, req.body, 'create');
    if (!parsed.ok) {
      logger.warn(`Create post ${id} failed: ${parsed.errors.join('; ')}`);
      res.status(400).json({ error: formatErrors('post', parsed.errors) });
      return;
    }
    if (parsed.ignored.length) logger.warn(`Create post ${id}: ignored unknown fields ${parsed.ignored.join(', ')}`);

    await withLock('posts', async () => {
      const filePath = resolveInside(postsDir, `${id}.json`);
      if (await fileExists(filePath)) {
        logger.warn(`Create post failed: ${id} already exists`);
        res.status(409).json({ error: 'Post already exists' });
        return;
      }
      const post = { id, ...parsed.value } as PostDetail;
      post.readingTime = calculateReadingTime(post.content);
      await writeJSON(filePath, post);
      await regenerateAfterWrite(`Creating post ${id}`);
      logger.info(`Created post: ${id}`);
      res.status(201).json(post);
    });
  } catch (err) {
    logger.error(`Failed to create post: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const parsed = parse(postSchema, req.body, 'update');
    if (!parsed.ok) {
      logger.warn(`Update post ${id} failed: ${parsed.errors.join('; ')}`);
      res.status(400).json({ error: formatErrors('post', parsed.errors) });
      return;
    }
    if (parsed.ignored.length) logger.warn(`Update post ${id}: ignored unknown fields ${parsed.ignored.join(', ')}`);

    await withLock('posts', async () => {
      const filePath = resolveInside(postsDir, `${id}.json`);
      if (!await fileExists(filePath)) {
        logger.warn(`Update post failed: ${id} not found`);
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      const existing = await readJSON<PostDetail>(filePath);
      const updated = { ...applyUpdate(existing, parsed), id, updatedAt: new Date().toISOString() };
      updated.readingTime = calculateReadingTime(updated.content ?? '');
      await writeJSON(filePath, updated);
      await regenerateAfterWrite(`Updating post ${id}`);
      logger.info(`Updated post: ${id}`);
      res.json(updated);
    });
  } catch (err) {
    logger.error(`Failed to update post ${id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await withLock('posts', async () => {
      const filePath = resolveInside(postsDir, `${id}.json`);
      if (!await fileExists(filePath)) {
        logger.warn(`Delete post failed: ${id} not found`);
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      await unlink(filePath);
      await regenerateAfterWrite(`Deleting post ${id}`);
      logger.info(`Deleted post: ${id}`);
      res.json({ success: true });
    });
  } catch (err) {
    logger.error(`Failed to delete post ${id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
