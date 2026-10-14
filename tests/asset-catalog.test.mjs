import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../src/world3d/renderer/loadCatalog.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function controlledLoader(paths) {
  const pending = new Map(paths.map(path => [path, deferred()]));
  const starts = [];
  let active = 0;
  let peak = 0;
  const load = async path => {
    starts.push(path); active++; peak = Math.max(peak, active);
    try { return await pending.get(path).promise; }
    finally { active--; }
  };
  return { pending, starts, load, get active() { return active; }, get peak() { return peak; } };
}

// Draining the known promise continuations gives workers time to dispatch their
// next item without real timers, browser work or nondeterministic sleeps.
async function drain() {
  for (let step = 0; step < 6; step++) await Promise.resolve();
}

test('catalog bounds network/decode concurrency at two while filling available capacity', async () => {
  const paths = ['math', 'fox', 'memory', 'language', 'environment'];
  const loader = controlledLoader(paths);
  const work = loadCatalog(paths, loader.load, new AbortController().signal);
  assert.deepEqual(loader.starts, ['math', 'fox']);
  assert.equal(loader.active, 2);
  loader.pending.get('fox').resolve({ id: 'fox' });
  await drain();
  assert.deepEqual(loader.starts, ['math', 'fox', 'memory']);
  assert.equal(loader.active, 2, 'a free slot must dispatch a queued asset');
  loader.pending.get('memory').resolve({ id: 'memory' });
  await drain();
  assert.deepEqual(loader.starts, ['math', 'fox', 'memory', 'language']);
  assert.equal(loader.active, 2);
  loader.pending.get('language').resolve({ id: 'language' });
  await drain();
  assert.equal(loader.starts.at(-1), 'environment');
  loader.pending.get('environment').resolve({ id: 'environment' });
  loader.pending.get('math').resolve({ id: 'math' });
  const results = await work;
  assert.equal(loader.peak, 2);
  assert.equal(loader.active, 0);
  assert.ok(results.every(result => result.status === 'fulfilled'));
});

test('results retain catalog order and exact decoded objects despite reversed completion order', async () => {
  const paths = ['first', 'second', 'third'];
  const loader = controlledLoader(paths);
  const objects = paths.map(id => ({ scene: { id }, animations: [] }));
  const work = loadCatalog(paths, loader.load, new AbortController().signal);
  loader.pending.get('second').resolve(objects[1]);
  await drain();
  loader.pending.get('third').resolve(objects[2]);
  await drain();
  loader.pending.get('first').resolve(objects[0]);
  const results = await work;
  for (let index = 0; index < paths.length; index++) {
    assert.equal(results[index].status, 'fulfilled');
    assert.equal(results[index].value, objects[index], 'caller can dispose the original decoded object');
  }
});

test('one failed decode preserves fulfilled outcomes and still loads the remaining catalog', async () => {
  const failure = new Error('damaged embedded texture');
  const objectA = { scene: { id: 'usable-a' } }, objectC = { scene: { id: 'usable-c' } };
  const calls = [];
  const results = await loadCatalog(['usable-a', 'broken', 'usable-c'], async path => {
    calls.push(path);
    if (path === 'broken') throw failure;
    return path === 'usable-a' ? objectA : objectC;
  }, new AbortController().signal);
  assert.deepEqual(calls, ['usable-a', 'broken', 'usable-c']);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.equal(results[0].value, objectA);
  assert.equal(results[1].reason, failure);
  assert.equal(results[2].value, objectC);
});

test('abort prevents queued allocations while retaining already decoded assets for cleanup', async () => {
  const paths = ['started-a', 'started-b', 'queued-c', 'queued-d', 'queued-e'];
  const loader = controlledLoader(paths);
  const controller = new AbortController();
  const reason = new Error('scene was closed while loading');
  const work = loadCatalog(paths, loader.load, controller.signal);
  const objectA = { scene: { id: 'started-a' } }, objectB = { scene: { id: 'started-b' } };
  controller.abort(reason);
  // These represent decoders that finish after the abort. The catalog must
  // retain their scenes rather than discard the caller's cleanup references.
  loader.pending.get('started-a').resolve(objectA);
  loader.pending.get('started-b').resolve(objectB);
  const results = await work;
  assert.deepEqual(loader.starts, ['started-a', 'started-b']);
  assert.equal(loader.peak, 2);
  assert.equal(results.length, paths.length);
  assert.equal(results[0].value, objectA);
  assert.equal(results[1].value, objectB);
  for (const result of results.slice(2)) {
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason, reason);
  }
});

test('an already aborted catalog never calls its loader', async () => {
  const controller = new AbortController(), reason = new Error('cancelled before allocation');
  controller.abort(reason);
  const results = await loadCatalog(['one', 'two', 'three'], async () => {
    assert.fail('aborted catalog must not allocate a decoder');
  }, controller.signal);
  assert.equal(results.length, 3);
  assert.ok(results.every(result => result.status === 'rejected' && result.reason === reason));
});

test('empty catalogs resolve to an empty cleanup list without invoking the loader', async () => {
  const results = await loadCatalog([], async () => { assert.fail('empty catalog must not allocate'); },
    new AbortController().signal);
  assert.deepEqual(results, []);
});
