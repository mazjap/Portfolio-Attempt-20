// The content snapshot (npm run snapshot) against a running local server with temporary content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { auth, postBody, projectBody, setup } from './helpers.js';

const { api, dirs } = await setup();
const { createApp } = await import('../src/app.js');
const { appIdsFromSitemap, takeSnapshot } = await import('../src/lib/snapshot.js');

test('app IDs come from the sitemap', () => {
  const xml = '<urlset><url><loc>https://x.test/apps/trekpoint/privacy-policy</loc></url><url><loc>https://x.test/apps/trekpoint/support</loc></url><url><loc>https://x.test/apps/numbase/support</loc></url><url><loc>https://x.test/projects/apps</loc></url></urlset>';
  assert.deepEqual(appIdsFromSitemap(xml), ['numbase', 'trekpoint']);
});

test('saves content and the media it uses, and records what is missing', async () => {
  // A legacy-named image (with spaces), a markdown image, and one that doesn't exist.
  await mkdir(join(dirs.media, 'projects', 'demo'), { recursive: true });
  await writeFile(join(dirs.media, 'projects', 'demo', '1. Launch.webp'), 'legacy image bytes');
  await mkdir(join(dirs.media, 'posts', 'hello'), { recursive: true });
  await writeFile(join(dirs.media, 'posts', 'hello', 'inline.webp'), 'inline image bytes');
  await api.post('/api/projects').set(auth).send(projectBody('demo', {
    media: [{ type: 'image', url: '/media/projects/demo/1. Launch.webp' }],
    heroImage: '/media/projects/demo/missing.webp',
  })).expect(201);
  await api.post('/api/posts').set(auth).send(postBody('hello', { content: 'Look: ![x](/media/posts/hello/inline.webp)' })).expect(201);
  await api.post('/api/apps/demoapp/support').set(auth).send({ appName: 'Demo', version: '1.0', content: 'Help' }).expect(201);

  const server = createApp().listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const outDir = join(await mkdtemp(join(tmpdir(), 'snapshot-')), 'out');
    const result = await takeSnapshot({ siteUrl: `http://127.0.0.1:${port}`, outDir, appIds: ['demoapp'] });

    assert.equal(result.projects, 1);
    assert.equal(result.posts, 1);
    assert.equal(result.appPages, 1);
    assert.equal(result.media, 2);
    assert.deepEqual(result.failures, ['/media/projects/demo/missing.webp: HTTP 404']);

    const saved = JSON.parse(await readFile(join(outDir, 'data', 'projects', 'demo.json'), 'utf-8'));
    const stored = JSON.parse(await readFile(join(dirs.data, 'projects', 'demo.json'), 'utf-8'));
    assert.deepEqual(saved, stored);
    assert.ok(existsSync(join(outDir, 'data', 'projects', 'index.json')));
    assert.ok(existsSync(join(outDir, 'data', 'posts', 'nav.json')));
    assert.ok(existsSync(join(outDir, 'data', 'apps', 'demoapp', 'support.json')));
    assert.ok(!existsSync(join(outDir, 'data', 'apps', 'demoapp', 'privacy-policy.json')), 'a 404 page is skipped, not an error');
    assert.equal(await readFile(join(outDir, 'public_html', 'media', 'projects', 'demo', '1. Launch.webp'), 'utf-8'), 'legacy image bytes');
    assert.equal(await readFile(join(outDir, 'public_html', 'media', 'posts', 'hello', 'inline.webp'), 'utf-8'), 'inline image bytes');
    assert.match(await readFile(join(outDir, 'MANIFEST.txt'), 'utf-8'), /Problems \(1\):\n {2}\/media\/projects\/demo\/missing\.webp: HTTP 404/);
  } finally {
    server.close();
  }
});
