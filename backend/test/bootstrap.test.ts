// First run against nothing: the server creates its storage and serves empty lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { setup } from './helpers.js';

const { api, dirs } = await setup({ bootstrap: false });
const { ensureStorage } = await import('../src/lib/bootstrap.js');

test('startup creates missing directories and indexes', async () => {
  assert.ok(!existsSync(dirs.data));
  await ensureStorage();
  for (const dir of ['projects', 'posts', 'apps']) assert.ok(existsSync(join(dirs.data, dir)), dir);
  assert.ok(existsSync(dirs.media));
  assert.deepEqual((await api.get('/api/projects')).body, []);
  assert.deepEqual((await api.get('/api/posts/nav')).body, []);
  assert.ok(existsSync(join(dirs.publicDir, 'sitemap.xml')));
});

test('an unreadable index is rebuilt at startup', async () => {
  await writeFile(join(dirs.data, 'projects', 'index.json'), '{not json');
  await ensureStorage();
  assert.deepEqual(JSON.parse(await readFile(join(dirs.data, 'projects', 'index.json'), 'utf-8')), []);
});
