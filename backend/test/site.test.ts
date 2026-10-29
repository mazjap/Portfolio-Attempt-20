// sitemap.xml, feed.xml, and share pages, regenerated as content changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { auth, postBody, projectBody, setup } from './helpers.js';

const { api, dirs } = await setup({ indexHtml: true });
const read = (...parts: string[]) => readFile(join(dirs.publicDir, ...parts), 'utf-8');

test('content changes update the sitemap, feed, and share pages', async () => {
  await api.post('/api/projects').set(auth).send(projectBody('demo', { title: 'Demo <script>alert("x")</script>', tagline: 'Fish & "chips"' })).expect(201);
  await api.post('/api/posts').set(auth).send(postBody('hello', { title: 'Hello & welcome', excerpt: 'First post' })).expect(201);
  await api.post('/api/apps/trekpoint/privacy-policy').set(auth).send({ appName: 'TrekPoint', lastUpdated: '2025-01-01', content: 'x' }).expect(201);

  const sitemap = await read('sitemap.xml');
  for (const path of ['/', '/projects', '/blog', '/projects/demo', '/blog/hello', '/apps/trekpoint/privacy-policy']) {
    assert.ok(sitemap.includes(`<loc>https://example.test${path === '/' ? '/' : path}</loc>`), path);
  }

  const feed = await read('feed.xml');
  assert.match(feed, /<title>Hello &amp; welcome<\/title>/);
  assert.match(feed, /<link>https:\/\/example.test\/blog\/hello<\/link>/);

  const share = await read('_meta', 'projects', 'demo.html');
  assert.match(share, /<title>Demo &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; · Jordan Christensen<\/title>/);
  assert.ok(!share.includes('<script>alert'), 'title is escaped');
  assert.match(share, /<meta name="description" content="Fish &amp; &quot;chips&quot;" \/>/);
  assert.match(share, /<meta property="og:url" content="https:\/\/example.test\/projects\/demo" \/>/);
  assert.match(share, /<script type="module" src="\/assets\/index-abc.js"><\/script>/, 'still boots the app');
  assert.equal((share.match(/<title>/g) ?? []).length, 1);
  assert.ok(existsSync(join(dirs.publicDir, '_meta', 'blog', 'hello.html')));
  assert.ok(existsSync(join(dirs.publicDir, '_meta', 'apps', 'trekpoint', 'privacy-policy.html')));
});

test('deleting content removes its share page and sitemap entry', async () => {
  await api.post('/api/projects').set(auth).send(projectBody('temporary')).expect(201);
  assert.ok(existsSync(join(dirs.publicDir, '_meta', 'projects', 'temporary.html')));
  await api.delete('/api/projects/temporary').set(auth).expect(200);
  assert.ok(!existsSync(join(dirs.publicDir, '_meta', 'projects', 'temporary.html')));
  assert.ok(!(await read('sitemap.xml')).includes('/projects/temporary'));
});
