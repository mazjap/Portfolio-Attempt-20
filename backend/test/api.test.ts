// HTTP behavior: path traversal, validation and Folio's write semantics, concurrency, bad records,
// error responses, and app pages. Runs against a temporary data directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { auth, postBody, projectBody, setup } from './helpers.js';

const { api, dirs } = await setup();
const readStored = async (kind: string, id: string) => JSON.parse(await readFile(join(dirs.data, kind, `${id}.json`), 'utf-8'));

test('encoded and literal traversal never reaches the filesystem', async () => {
  await writeFile(join(dirs.root, 'secret.json'), '{"secret":true}');
  for (const path of ['/api/projects/..%2F..%2Fsecret', '/api/posts/..%2F..%2Fsecret', '/api/apps/..%2F..%2Fx/privacy-policy']) {
    const res = await api.get(path);
    assert.equal(res.status, 404, path);
    assert.ok(!JSON.stringify(res.body).includes('secret":true'), path);
  }
  assert.equal((await api.put('/api/projects/..%2Fsecret').set(auth).send({})).status, 400);
  assert.equal((await api.delete('/api/posts/..%2Fsecret').set(auth)).status, 400);
  const created = await api.post('/api/projects').set(auth).send(projectBody('../../escape'));
  assert.equal(created.status, 400);
  // '../../escape' from data/projects would land at the temp root.
  const outside = (await readdir(dirs.root)).filter(name => !['data', 'logs', 'public_html', 'secret.json'].includes(name));
  assert.deepEqual(outside, []);
});

test('reserved and malformed IDs are rejected', async () => {
  for (const id of ['index', 'nav', 'Hello', 'a_b']) {
    const res = await api.post('/api/projects').set(auth).send(projectBody(id));
    assert.equal(res.status, 400, id);
  }
});

test('writes require the token', async () => {
  assert.equal((await api.post('/api/projects').send(projectBody('no-auth'))).status, 401);
  assert.equal((await api.post('/api/projects').set({ Authorization: 'Bearer wrong' }).send(projectBody('no-auth'))).status, 401);
});

test('validation rejects incomplete or malformed content with every problem listed', async () => {
  const res = await api.post('/api/projects').set(auth).send({ id: 'minimal' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /title is required; tagline is required; status is required/);
  assert.equal((await api.post('/api/projects').set(auth).send(projectBody('bad-status', { status: 'nonsense' }))).status, 400);
  assert.equal((await api.post('/api/posts').set(auth).send({ id: 'p' })).status, 400);
  assert.equal((await api.post('/api/posts').set(auth).send(postBody('p', { tags: 'swift' }))).status, 400);
});

test('Folio create and update semantics', async () => {
  const created = await api.post('/api/projects').set(auth).send({ id: 'demo', title: 'Demo', tagline: 't', status: 'active', unknown: 1 });
  assert.equal(created.status, 201);
  assert.equal(created.body.featured, false, 'defaults filled');
  assert.ok(!('unknown' in created.body), 'unknown fields dropped');

  await api.put('/api/projects/demo').set(auth).send({ category: 'Web' }).expect(200);
  const updated = await api.put('/api/projects/demo').set(auth).send({
    id: 'renamed', title: 'Demo 2', category: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '1999-01-01T00:00:00Z',
  });
  assert.equal(updated.status, 200);
  const stored = await readStored('projects', 'demo');
  assert.equal(stored.id, 'demo', 'id in the body is ignored');
  assert.equal(stored.title, 'Demo 2');
  assert.ok(!('category' in stored), 'null clears');
  assert.equal(stored.createdAt, '2024-01-01T00:00:00Z', 'createdAt is editable');
  assert.notEqual(stored.updatedAt, '1999-01-01T00:00:00Z', 'updatedAt is server-owned');
  assert.equal((await api.get('/api/projects/renamed')).status, 404);

  await api.post('/api/posts').set(auth).send(postBody('reading', { readingTime: 42 })).expect(201);
  const post = await api.put('/api/posts/reading').set(auth).send({ readingTime: 999 });
  assert.equal(post.body.readingTime, 1, 'readingTime is server-owned');
});

test('concurrent updates to one record all survive', async () => {
  await api.post('/api/projects').set(auth).send(projectBody('busy')).expect(201);
  const updates = [
    { title: 'T' }, { tagline: 'tag' }, { description: 'desc' }, { category: 'Cat' },
    { heroImage: '/media/x.webp' }, { featured: true }, { techStack: ['Go'] }, { links: { Site: 'https://x.dev' } },
  ];
  const results = await Promise.all(updates.map(body => api.put('/api/projects/busy').set(auth).send(body)));
  assert.deepEqual(results.map(r => r.status), updates.map(() => 200));
  const stored = await readStored('projects', 'busy');
  for (const body of updates) {
    for (const [key, value] of Object.entries(body)) assert.deepEqual(stored[key], value, key);
  }
  const creates = await Promise.all(Array.from({ length: 15 }, (_, i) => api.post('/api/projects').set(auth).send(projectBody(`bulk-${i}`))));
  assert.ok(creates.every(r => r.status === 201));
  const index = (await api.get('/api/projects')).body as { id: string }[];
  for (let i = 0; i < 15; i++) assert.ok(index.some(p => p.id === `bulk-${i}`), `bulk-${i} listed`);
  assert.ok(!(await readdir(join(dirs.data, 'projects'))).some(f => f.endsWith('.tmp')), 'no temp files left');
});

test('a corrupt record is skipped instead of blocking publishing', async () => {
  await writeFile(join(dirs.data, 'projects', 'broken.json'), '{"id":"broken","title":');
  await writeFile(join(dirs.data, 'projects', 'bad-status.json'), JSON.stringify({ ...projectBody('bad-status'), status: 'nonsense' }));
  await api.post('/api/projects').set(auth).send(projectBody('after-corruption')).expect(201);
  const ids = ((await api.get('/api/projects')).body as { id: string }[]).map(p => p.id);
  assert.ok(ids.includes('after-corruption'));
  assert.ok(!ids.includes('broken') && !ids.includes('bad-status'));
});

test('errors are JSON', async () => {
  const malformed = await api.post('/api/projects').set(auth).set('Content-Type', 'application/json').send('{bad');
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { error: 'Malformed JSON body' });
  const big = await api.post('/api/posts').set(auth).send(postBody('big', { content: 'x'.repeat(1_200_000) }));
  assert.equal(big.status, 413);
  assert.match(big.body.error, /larger than/);
  const cors = await api.get('/api/projects').set('Origin', 'https://evil.example');
  assert.equal(cors.status, 403);
  assert.deepEqual((await api.get('/api/nope')).body, { error: 'Not found' });
  assert.deepEqual((await api.get('/api/health')).body, { status: 'ok' });
});

test('app pages: validation, merge, clear, and delete', async () => {
  const base = '/api/apps/trekpoint/privacy-policy';
  assert.equal((await api.post(base).set(auth).send({ appName: 'TrekPoint', lastUpdated: '2025-02-30', content: 'x' })).status, 400);
  await api.post(base).set(auth).send({ appName: 'TrekPoint', lastUpdated: '2025-01-01', content: 'x', contactUrl: 'mailto:a@b.co' }).expect(201);
  assert.equal((await api.post(base).set(auth).send({ appName: 'TrekPoint', lastUpdated: '2025-01-01', content: 'x' })).status, 409);
  const cleared = await api.put(base).set(auth).send({ contactUrl: null });
  assert.ok(!('contactUrl' in cleared.body));
  assert.equal((await api.get(base)).body.appName, 'TrekPoint');
  assert.equal((await api.post('/api/apps/trekpoint/support').set(auth).send({ appName: 'TrekPoint', content: 'x' })).status, 400, 'version is required');
  await api.delete(base).set(auth).expect(200);
  assert.equal((await api.get(base)).status, 404);
});
