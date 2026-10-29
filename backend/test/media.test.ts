// Uploads and deletes: orientation, safe names, generated sizes, format checks, and containment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { auth, setup } from './helpers.js';

const { api, dirs } = await setup();
const mediaFile = (...parts: string[]) => join(dirs.media, ...parts);

const jpeg = (width: number, height: number, orientation?: number) => {
  const image = sharp({ create: { width, height, channels: 3, background: '#c33' } }).jpeg();
  return (orientation ? image.withMetadata({ orientation }) : image).toBuffer();
};

function upload(file: Buffer, filename: string, contentType: string, fields: Record<string, string> = {}) {
  const req = api.post('/api/media/upload').set(auth).field('context', fields.context ?? 'projects').field('id', fields.id ?? 'demo');
  if (fields.overwrite) req.field('overwrite', fields.overwrite);
  return req.attach('file', file, { filename, contentType });
}

test('photos are stored upright, with a URL-safe name and smaller sizes', async () => {
  const res = await upload(await jpeg(120, 60, 6), 'photo#1.jpg', 'image/jpeg');
  assert.equal(res.status, 200);
  assert.equal(res.body.url, '/media/projects/demo/photo-1.webp');
  const main = await sharp(mediaFile('projects', 'demo', 'photo-1.webp')).metadata();
  assert.deepEqual([main.width, main.height], [60, 120], 'EXIF orientation applied');
  for (const width of [640, 1280]) assert.ok(existsSync(mediaFile('projects', 'demo', `photo-1.w${width}.webp`)), `w${width}`);
  assert.equal((await upload(await jpeg(10, 10), 'photo#1.jpg', 'image/jpeg')).status, 409);
  assert.equal((await upload(await jpeg(10, 10), 'photo#1.jpg', 'image/jpeg', { overwrite: 'true' })).status, 200);
});

test('large images are bounded to 2560 px, and sizes are scaled by width', async () => {
  await upload(await jpeg(3000, 1000), 'wide.jpg', 'image/jpeg').expect(200);
  const main = await sharp(mediaFile('projects', 'demo', 'wide.webp')).metadata();
  assert.deepEqual([main.width, main.height], [2560, 853]);
  const small = await sharp(mediaFile('projects', 'demo', 'wide.w640.webp')).metadata();
  assert.equal(small.width, 640);
});

test('names with accents are cleaned, and unusable names are rejected', async () => {
  assert.equal((await upload(await jpeg(10, 10), 'Café Ünïcode.png', 'image/png')).body.url, '/media/projects/demo/Cafe-Unicode.webp');
  assert.equal((await upload(await jpeg(10, 10), '###.jpg', 'image/jpeg')).status, 400);
});

test('animated WebP keeps its frames', async () => {
  const frame = (c: string) => sharp({ create: { width: 40, height: 20, channels: 4, background: c } }).png().toBuffer();
  const animated = await sharp(await Promise.all([frame('#f00'), frame('#0f0'), frame('#00f')]), { join: { animated: true } }).webp().toBuffer();
  await upload(animated, 'anim.webp', 'image/webp').expect(200);
  const meta = await sharp(mediaFile('projects', 'demo', 'anim.webp'), { animated: true }).metadata();
  assert.equal(meta.pages, 3);
});

test('the file itself is checked, not the claimed type', async () => {
  const fake = await upload(Buffer.from('not an image'), 'fake.jpg', 'image/jpeg');
  assert.equal(fake.status, 400);
  assert.equal((await upload(Buffer.from('hi'), 'note.txt', 'text/plain')).status, 400);
  assert.equal((await upload(await jpeg(10, 10), 'x.jpg', 'image/jpeg', { id: '../../../escape' })).status, 400);
  assert.equal((await upload(await jpeg(10, 10), 'x.jpg', 'image/jpeg', { context: 'apps' })).status, 400);
});

test('delete removes an image with its sizes, accepts legacy names, and stays in its folder', async () => {
  await upload(await jpeg(20, 20), 'gone.jpg', 'image/jpeg').expect(200);
  await api.delete('/api/media/projects/demo/gone.webp').set(auth).expect(200);
  const remaining = await readdir(mediaFile('projects', 'demo'));
  assert.ok(!remaining.some(f => f.startsWith('gone.')), remaining.join(', '));

  await writeFile(mediaFile('projects', 'demo', '1. Launch.webp'), 'x');
  await api.delete('/api/media/projects/demo/1.%20Launch.webp').set(auth).expect(200);

  await writeFile(join(dirs.root, 'keep.webp'), 'x');
  for (const path of ['/api/media/projects/demo/..%2F..%2F..%2Fkeep.webp', '/api/media/projects/..%2F..%2F..%2F/keep.webp', '/api/media/projects/demo/notes.txt', '/api/media/projects/demo/.hidden.webp']) {
    assert.equal((await api.delete(path).set(auth)).status, 400, path);
  }
  assert.ok(existsSync(join(dirs.root, 'keep.webp')));
  assert.equal((await api.delete('/api/media/projects/demo/missing.webp').set(auth)).status, 404);
});
