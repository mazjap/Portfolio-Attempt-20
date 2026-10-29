// Pure helpers: ID and filename rules, path containment, and the validation/merge semantics Folio uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { isValidContentId, isValidMediaFilename, isValidSlug, resolveInside, safeMediaBaseName, PathEscapeError } from '../src/lib/paths.js';
import { applyUpdate, calculateReadingTime, parse, postSchema, privacyPolicySchema, projectSchema } from '../src/lib/schemas.js';
import { derivativePath, isDerivative } from '../src/lib/images.js';

test('content IDs are lowercase slugs, and index/nav are reserved', () => {
  for (const id of ['trekpoint', 'nes-emulator', 'hailey60', 'a']) assert.ok(isValidContentId(id), id);
  for (const id of ['', 'Hello', 'a_b', 'a--b', '-a', 'a-', '../x', '..%2Fx', 'a/b', 'index', 'nav', 'x'.repeat(101)]) {
    assert.ok(!isValidContentId(id), id);
  }
  assert.ok(isValidSlug('index'), 'apps may use index');
});

test('media filenames: legacy names allowed, separators and hidden files not', () => {
  for (const name of ['hero.jpg', '4D7E28F0-E263.webp', '1. Launch.webp', 'Screenshot 2026 at 1.45.58â\u0080¯PM.webp', 'x.w640.webp']) {
    assert.ok(isValidMediaFilename(name), name);
  }
  for (const name of ['../x.webp', 'a/b.webp', 'a\\b.webp', '.x.webp', 'notes.txt', 'noext', 'a\u0000.webp']) {
    assert.ok(!isValidMediaFilename(name), name);
  }
});

test('uploaded names become URL-safe and keep case', () => {
  assert.equal(safeMediaBaseName('photo#1.jpg'), 'photo-1');
  assert.equal(safeMediaBaseName('Café Ünïcode.png'), 'Cafe-Unicode');
  assert.equal(safeMediaBaseName('Screenshot 2026-10-29 at 1.05.33 PM.jpg'), 'Screenshot-2026-10-29-at-1-05-33-PM');
  assert.equal(safeMediaBaseName('4D7E28F0-E263.HEIC'), '4D7E28F0-E263');
  assert.equal(safeMediaBaseName('###.jpg'), null);
});

test('resolveInside rejects paths that escape the root', () => {
  const root = '/srv/data';
  assert.equal(resolveInside(root, 'projects', 'a.json'), join(root, 'projects', 'a.json'));
  assert.throws(() => resolveInside(root, '..', 'etc'), PathEscapeError);
  assert.throws(() => resolveInside(root, 'a/../../b'), PathEscapeError);
  assert.throws(() => resolveInside(root, '/etc/passwd'), PathEscapeError);
});

test('create fills defaults; update merges, clears nulls, and ignores server-owned fields', () => {
  const created = parse(projectSchema, { id: 'x', title: 'T', tagline: 't', status: 'active', extra: 1 }, 'create');
  assert.ok(created.ok);
  assert.deepEqual(created.ignored, ['extra']);
  assert.equal(created.value.featured, false);
  assert.deepEqual(created.value.media, []);
  assert.equal(typeof created.value.createdAt, 'string');

  const update = parse(projectSchema, { id: 'renamed', category: null, title: 'New', updatedAt: 'x', createdAt: '2024-01-01T00:00:00Z' }, 'update');
  assert.ok(update.ok);
  assert.deepEqual(update.cleared, ['category']);
  assert.deepEqual(update.ignored, []);
  const merged = applyUpdate({ id: 'x', title: 'Old', category: 'Web', tagline: 't' }, update);
  assert.deepEqual(merged, { id: 'x', title: 'New', tagline: 't', createdAt: '2024-01-01T00:00:00Z' });
});

test('validation reports every problem', () => {
  const result = parse(projectSchema, { title: '', status: 'nonsense', links: { x: 'javascript:alert(1)' }, createdAt: 'yesterday' }, 'create');
  assert.ok(!result.ok);
  assert.equal(result.errors.length, 5); // title empty, tagline missing, status, link, date
  assert.ok(!parse(projectSchema, { title: null }, 'update').ok, 'null on a required field');
  assert.ok(!parse(postSchema, { title: 'T', tags: 'swift' }, 'create').ok);
  assert.ok(!parse(privacyPolicySchema, { appName: 'A', lastUpdated: '2025-02-30', content: 'x' }, 'create').ok, 'impossible date');
  assert.ok(parse(projectSchema, { media: [{ type: 'image', url: '/media/projects/x/1. Launch.webp' }] }, 'update').ok, 'legacy URL with spaces');
  assert.ok(!parse(projectSchema, { heroImage: '//evil.example/x.png' }, 'update').ok, 'protocol-relative URL');
});

test('reading time and image size names', () => {
  assert.equal(calculateReadingTime(''), 0);
  assert.equal(calculateReadingTime('word '.repeat(201)), 2);
  assert.equal(derivativePath('/media/projects/a/hero.webp', 640), '/media/projects/a/hero.w640.webp');
  assert.ok(isDerivative('hero.w1280.webp'));
  assert.ok(!isDerivative('hero.webp'));
});
