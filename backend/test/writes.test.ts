// Conditional writes (X-Expected-Version), safe create retries, app page versions and the app index,
// and media cleanup when content is deleted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { auth, postBody, projectBody, setup } from './helpers.js';

const { api, dirs } = await setup();
const readStored = async (...parts: string[]) => JSON.parse(await readFile(join(dirs.data, ...parts), 'utf-8'));
const VERSION = 'X-Expected-Version';
/** Drops fractional seconds, the way Swift's `.iso8601` strategy encodes a decoded date. */
const wholeSeconds = (iso: string) => iso.replace(/\.\d+Z$/, 'Z');

async function addMedia(...parts: string[]): Promise<string> {
  const path = join(dirs.media, ...parts);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, 'x');
  return path;
}

test('a PUT based on an old version gets 409 with the current record', async () => {
  await api.post('/api/posts').set(auth).send(postBody('versioned', { createdAt: '2025-03-01T10:00:00Z' })).expect(201);

  // Never updated: the version is createdAt.
  const first = await api.put('/api/posts/versioned').set(auth).set(VERSION, '2025-03-01T10:00:00Z').send({ title: 'First edit' });
  assert.equal(first.status, 200);
  const version = first.body.updatedAt as string;
  assert.match(version, /\.\d{3}Z$/);

  // Another device saves meanwhile, starting from the same version.
  await api.put('/api/posts/versioned').set(auth).set(VERSION, version).send({ title: 'Other device' }).expect(200);

  const stale = await api.put('/api/posts/versioned').set(auth).set(VERSION, version).send({ title: 'Stale edit' });
  assert.equal(stale.status, 409);
  assert.match(stale.body.error, /changed on the server/);
  assert.equal(stale.body.current.title, 'Other device');
  assert.equal((await readStored('posts', 'versioned.json')).title, 'Other device', 'nothing overwritten');

  // Clients that drop fractional seconds are compared to the second.
  const current = (await api.get('/api/posts/versioned')).body.updatedAt as string;
  await api.put('/api/posts/versioned').set(auth).set(VERSION, wholeSeconds(current)).send({ title: 'Whole seconds' }).expect(200);
  const old = new Date(Date.parse(current) - 2000).toISOString();
  assert.equal((await api.put('/api/posts/versioned').set(auth).set(VERSION, wholeSeconds(old)).send({ title: 'x' })).status, 409);

  // Without the header, writes stay unconditional (older Folio builds).
  await api.put('/api/posts/versioned').set(auth).send({ title: 'Unconditional' }).expect(200);

  const malformed = await api.put('/api/posts/versioned').set(auth).set(VERSION, 'yesterday').send({ title: 'x' });
  assert.equal(malformed.status, 400);
  assert.match(malformed.body.error, /X-Expected-Version/);
});

test('a DELETE based on an old version gets 409, and a current one deletes', async () => {
  const created = await api.post('/api/projects').set(auth).send(projectBody('doomed')).expect(201);
  const updated = await api.put('/api/projects/doomed').set(auth).send({ title: 'Changed elsewhere' }).expect(200);

  const stale = await api.delete('/api/projects/doomed').set(auth).set(VERSION, created.body.createdAt);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.title, 'Changed elsewhere');
  assert.ok(existsSync(join(dirs.data, 'projects', 'doomed.json')));

  await api.delete('/api/projects/doomed').set(auth).set(VERSION, updated.body.updatedAt).expect(200);
  assert.equal((await api.get('/api/projects/doomed')).status, 404);
});

test('app pages get updatedAt on create and update, and use it for conditional writes', async () => {
  const base = '/api/apps/versioned-app/support';
  const created = await api.post(base).set(auth).send({ appName: 'Versioned', version: '1.0', content: 'Help', updatedAt: '1999-01-01T00:00:00Z' });
  assert.equal(created.status, 201);
  assert.ok(created.body.updatedAt && created.body.updatedAt !== '1999-01-01T00:00:00Z', 'server-owned');
  assert.equal((await readStored('apps', 'versioned-app', 'support.json')).updatedAt, created.body.updatedAt);

  const updated = await api.put(base).set(auth).set(VERSION, wholeSeconds(created.body.updatedAt)).send({ version: '1.1' });
  assert.equal(updated.status, 200);
  assert.ok(Date.parse(updated.body.updatedAt) >= Date.parse(created.body.updatedAt));
  assert.equal((await api.get(base)).body.updatedAt, updated.body.updatedAt);

  const stale = await api.put(base).set(auth).set(VERSION, '2020-01-01T00:00:00Z').send({ version: '9' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.version, '1.1');
  assert.equal((await api.delete(base).set(auth).set(VERSION, '2020-01-01T00:00:00Z')).status, 409);

  // A page saved before updatedAt existed has no version: unconditional writes work and give it one.
  await mkdir(join(dirs.data, 'apps', 'legacy-app'), { recursive: true });
  await writeFile(join(dirs.data, 'apps', 'legacy-app', 'privacy-policy.json'), JSON.stringify({ id: 'legacy-app', appName: 'Legacy', lastUpdated: '2024-01-01', content: 'x' }));
  assert.equal((await api.put('/api/apps/legacy-app/privacy-policy').set(auth).set(VERSION, '2024-01-01T00:00:00Z').send({ content: 'y' })).status, 409);
  const saved = await api.put('/api/apps/legacy-app/privacy-policy').set(auth).send({ content: 'y' });
  assert.equal(saved.status, 200);
  assert.ok(saved.body.updatedAt);
});

test('retrying a create whose response was lost returns the stored record', async () => {
  // A post without createdAt: the retry's default "now" differs, but it's still the same create.
  const body = postBody('retried', { heroImage: '/media/posts/retried/hero.webp' });
  const first = await api.post('/api/posts').set(auth).send(body);
  assert.equal(first.status, 201);
  const retry = await api.post('/api/posts').set(auth).send(body);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, first.body);

  const different = await api.post('/api/posts').set(auth).send({ ...body, title: 'Someone else' });
  assert.equal(different.status, 409);
  const differentDate = await api.post('/api/posts').set(auth).send({ ...body, createdAt: '2020-01-01T00:00:00Z' });
  assert.equal(differentDate.status, 409);

  await api.post('/api/projects').set(auth).send(projectBody('retried')).expect(201);
  assert.equal((await api.post('/api/projects').set(auth).send(projectBody('retried'))).status, 200);
  await api.put('/api/projects/retried').set(auth).send({ tagline: 'Edited since' }).expect(200);
  assert.equal((await api.post('/api/projects').set(auth).send(projectBody('retried'))).status, 409, 'an edited record is not a retry');

  const page = { appName: 'Retried', lastUpdated: '2025-01-01', content: 'x', contactText: 'Email me' };
  await api.post('/api/apps/retried/privacy-policy').set(auth).send(page).expect(201);
  assert.equal((await api.post('/api/apps/retried/privacy-policy').set(auth).send(page)).status, 200);
  assert.equal((await api.post('/api/apps/retried/privacy-policy').set(auth).send({ ...page, contactText: undefined })).status, 409);
});

test('GET /api/apps lists every app and which pages it has', async () => {
  await api.post('/api/apps/zeta/support').set(auth).send({ appName: 'Zeta', version: '1', content: 'x' }).expect(201);
  await api.post('/api/apps/alpha/privacy-policy').set(auth).send({ appName: 'Alpha', lastUpdated: '2025-01-01', content: 'x' }).expect(201);
  await api.post('/api/apps/alpha/support').set(auth).send({ appName: 'Alpha App', version: '1', content: 'x' }).expect(201);
  await mkdir(join(dirs.data, 'apps', 'empty'), { recursive: true });
  await mkdir(join(dirs.data, 'apps', 'Bad_Name'), { recursive: true });
  await writeFile(join(dirs.data, 'apps', 'Bad_Name', 'support.json'), '{}');
  await mkdir(join(dirs.data, 'apps', 'broken'), { recursive: true });
  await writeFile(join(dirs.data, 'apps', 'broken', 'support.json'), '{"appName":');

  const res = await api.get('/api/apps');
  assert.equal(res.status, 200);
  const byId = Object.fromEntries((res.body as { id: string }[]).map(app => [app.id, app]));
  assert.deepEqual(byId.alpha, { id: 'alpha', appName: 'Alpha', pages: ['privacy-policy', 'support'] });
  assert.deepEqual(byId.zeta, { id: 'zeta', appName: 'Zeta', pages: ['support'] });
  assert.deepEqual(byId.broken, { id: 'broken', appName: 'broken', pages: ['support'] }, 'unreadable page: still listed, named by ID');
  assert.ok(!byId.empty && !byId.Bad_Name);
  const ids = (res.body as { id: string }[]).map(app => app.id);
  assert.deepEqual(ids, [...ids].sort());
});

test('deleting an item deletes its unused media, but keeps files other content uses', async () => {
  await api.post('/api/projects').set(auth).send(projectBody('gallery', { heroImage: '/media/projects/gallery/hero.webp' })).expect(201);
  for (const name of ['hero.webp', 'hero.w640.webp', 'hero.w1280.webp', 'shared.webp', 'shared.w640.webp', '2. Legacy Shot.webp', '.DS_Store']) {
    await addMedia('projects', 'gallery', name);
  }
  // Another post embeds two of the project's files: one by its plain path, one percent-encoded.
  await api.post('/api/posts').set(auth).send(postBody('borrower', {
    content: 'See ![](/media/projects/gallery/shared.webp) and ![](</media/projects/gallery/2.%20Legacy%20Shot.webp>)',
  })).expect(201);

  await api.delete('/api/projects/gallery').set(auth).expect(200);
  const folder = join(dirs.media, 'projects', 'gallery');
  for (const gone of ['hero.webp', 'hero.w640.webp', 'hero.w1280.webp', '.DS_Store']) assert.ok(!existsSync(join(folder, gone)), gone);
  for (const kept of ['shared.webp', 'shared.w640.webp', '2. Legacy Shot.webp']) assert.ok(existsSync(join(folder, kept)), kept);

  // Once nothing uses them, deleting another item with no folder is fine, and the folder goes too.
  await api.post('/api/projects').set(auth).send(projectBody('solo')).expect(201);
  await addMedia('projects', 'solo', 'only.webp');
  await api.delete('/api/projects/solo').set(auth).expect(200);
  assert.ok(!existsSync(join(dirs.media, 'projects', 'solo')), 'empty folder removed');
});

test('the media delete route refuses a file that content still uses', async () => {
  await addMedia('posts', 'host', 'inline.webp');
  await addMedia('posts', 'host', 'inline.w640.webp');
  await addMedia('posts', 'host', '3. With Spaces.webp');
  await addMedia('posts', 'host', 'unused.webp');
  await api.post('/api/posts').set(auth).send(postBody('host', { content: '![a](/media/posts/host/inline.w640.webp)' })).expect(201);
  await api.post('/api/projects').set(auth).send(projectBody('elsewhere', {
    media: [{ type: 'image', url: '/media/posts/host/3. With Spaces.webp' }],
  })).expect(201);

  const inUse = await api.delete('/api/media/posts/host/inline.webp').set(auth);
  assert.equal(inUse.status, 409, 'its 640 px size is embedded');
  assert.match(inUse.body.error, /still used by post "host"/);
  assert.deepEqual(inUse.body.usedBy, ['post "host"']);
  const spaced = await api.delete('/api/media/posts/host/3.%20With%20Spaces.webp').set(auth);
  assert.equal(spaced.status, 409);
  assert.deepEqual(spaced.body.usedBy, ['project "elsewhere"']);
  assert.ok(existsSync(join(dirs.media, 'posts', 'host', 'inline.webp')));

  await api.delete('/api/media/posts/host/unused.webp').set(auth).expect(200);
  await api.put('/api/posts/host').set(auth).send({ content: 'No images now' }).expect(200);
  await api.delete('/api/media/posts/host/inline.webp').set(auth).expect(200);
  assert.ok(!existsSync(join(dirs.media, 'posts', 'host', 'inline.w640.webp')));
});
