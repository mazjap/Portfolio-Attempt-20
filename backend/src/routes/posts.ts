import { Router } from 'express';
import { join } from 'path';
import { access, unlink } from 'fs/promises';
import { authenticate } from '../middleware/auth.js';
import { readJSON, writeJSON, postsDir } from '../lib/files.js';
import { regeneratePosts } from '../lib/regenerate.js';
import { logger } from '../lib/logger.js';
import type { PostDetail, PostPreview, PostNav } from '../lib/types.js';

const router = Router();

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 200);
}

router.get('/', async (_req, res) => {
  try {
    const index = await readJSON<PostPreview[]>(join(postsDir, 'index.json'));
    logger.info('Listed posts');
    res.json(index);
  } catch (err) {
    logger.error(`Failed to list posts: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nav', async (_req, res) => {
  try {
    const nav = await readJSON<PostNav[]>(join(postsDir, 'nav.json'));
    logger.info('Listed posts nav');
    res.json(nav);
  } catch (err) {
    logger.error(`Failed to list posts nav: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const filePath = join(postsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      logger.warn(`Post not found: ${req.params.id}`);
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const post = await readJSON<PostDetail>(filePath);
    logger.info(`Fetched post: ${req.params.id}`);
    res.json(post);
  } catch (err) {
    logger.error(`Failed to fetch post ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const post = req.body as PostDetail;
    if (!post.id) {
      logger.warn('Create post failed: missing id');
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const filePath = join(postsDir, `${post.id}.json`);
    if (await fileExists(filePath)) {
      logger.warn(`Create post failed: ${post.id} already exists`);
      res.status(409).json({ error: 'Post already exists' });
      return;
    }
    post.readingTime = calculateReadingTime(post.content ?? '');
    post.createdAt ??= new Date().toISOString();
    await writeJSON(filePath, post);
    await regeneratePosts();
    logger.info(`Created post: ${post.id}`);
    res.status(201).json(post);
  } catch (err) {
    logger.error(`Failed to create post: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const filePath = join(postsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      logger.warn(`Update post failed: ${req.params.id} not found`);
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const existing = await readJSON<PostDetail>(filePath);
    const incoming = req.body as Partial<PostDetail>;
    const updated: PostDetail = { ...existing, ...incoming, updatedAt: new Date().toISOString() };
    if (incoming.content !== undefined) {
      updated.readingTime = calculateReadingTime(incoming.content);
    }
    await writeJSON(filePath, updated);
    await regeneratePosts();
    logger.info(`Updated post: ${req.params.id}`);
    res.json(updated);
  } catch (err) {
    logger.error(`Failed to update post ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const filePath = join(postsDir, `${req.params.id}.json`);
    if (!await fileExists(filePath)) {
      logger.warn(`Delete post failed: ${req.params.id} not found`);
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    await unlink(filePath);
    await regeneratePosts();
    logger.info(`Deleted post: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Failed to delete post ${req.params.id}: ${err}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
