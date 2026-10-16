import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, stat, utimes, unlink, rmdir } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzip, brotliDecompress } from 'node:zlib';
import { MODEL_FILES, createModelTransportMiddleware, modelTransportPlugin, negotiateModelEncoding } from '../tools/modelTransport.mjs';

const unzip = promisify(gunzip), unbrotli = promisify(brotliDecompress);
const models = fileURLToPath(new URL('../public/models', import.meta.url));
async function host(t, modelDir = models, { vary } = {}) {
  const middleware = createModelTransportMiddleware({ modelDir });
  const server = createServer((req, res) => {
    if (vary) res.setHeader('Vary', vary);
    void middleware(req, res, error => {
      res.setHeader('X-Delegated', '1'); res.statusCode = error ? 500 : 404;
      res.end(error ? String(error) : 'delegated');
    });
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => server.close(resolveClose)));
  const port = server.address().port;
  const get = (path, headers = {}, method = 'GET') => new Promise((resolveRequest, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end();
  });
  return { middleware, get, url: `http://127.0.0.1:${port}` };
}
async function temporary(t) {
  const prefix = 'baoan-model-transport-', directory = resolve(await mkdtemp(join(tmpdir(), prefix)));
  const files = [], folders = [];
  const put = async (relative, bytes) => {
    const file = resolve(directory, relative), folder = dirname(file);
    assert.ok(file.startsWith(`${directory}\\`) || file.startsWith(`${directory}/`), 'fixture stays in its unique directory');
    await mkdir(folder, { recursive: true }); if (!folders.includes(folder)) folders.push(folder);
    await writeFile(file, bytes); if (!files.includes(file)) files.push(file); return file;
  };
  t.after(async () => {
    assert.equal(dirname(directory), resolve(tmpdir())); assert.ok(basename(directory).startsWith(prefix));
    for (const file of files) await unlink(file);
    const ancestors = new Set();
    for (const folder of folders) for (let current = folder; current !== directory; current = dirname(current)) ancestors.add(current);
    for (const folder of [...ancestors].sort((a, b) => b.length - a.length)) await rmdir(folder);
    await rmdir(directory);
  });
  return { directory, put };
}

test('Encoding negotiation honors exclusions, weighted preferences and identity fallback', () => {
  const cases = [
    [undefined, 'identity'], ['', 'identity'], ['br, gzip', 'br'], ['gzip, br;q=0.5', 'gzip'],
    ['br;q=0, gzip;q=0.8', 'gzip'], ['br;q=0, gzip;q=0', 'identity'],
    ['br;q=0, *;q=1', 'gzip'], ['*;q=0', null], ['identity;q=1, *;q=0', 'identity'],
    ['identity;q=1, gzip;q=0.5', 'identity'], ['identity;q=0, br;q=0, gzip;q=0', null],
    ['compress, *;q=0.5', 'br'], ['BR ; Q = 0, gzip', 'gzip'], ['br;q=invalid, gzip', 'gzip'],
  ];
  for (const [header, expected] of cases) assert.equal(negotiateModelEncoding(header), expected, String(header));
});

test('All five shipped GLBs round trip through gzip and Brotli with correct HTTP metadata', async t => {
  const { get, middleware } = await host(t, models, { vary: 'Origin' });
  let rawBytes = 0, gzipBytes = 0, brotliBytes = 0;
  for (const file of MODEL_FILES) {
    const source = await readFile(join(models, file)); rawBytes += source.length;
    const compressed = await Promise.all(['gzip', 'br'].map(async encoding => {
      const result = await get(`/models/${file}?v=37`, { 'Accept-Encoding': encoding });
      assert.equal(result.status, 200); assert.equal(result.headers['content-type'], 'model/gltf-binary');
      assert.equal(result.headers['content-encoding'], encoding);
      assert.equal(Number(result.headers['content-length']), result.bytes.length);
      assert.equal(result.headers.vary, 'Origin, Accept-Encoding');
      assert.equal(result.headers['cache-control'], 'public, max-age=0, must-revalidate');
      assert.match(result.headers.etag, new RegExp(`^"baoan-${encoding}-[0-9a-f]{64}"$`));
      assert.ok(result.bytes.length < source.length * .85, `${file}/${encoding} meaningfully reduces transport bytes`);
      assert.deepEqual(await (encoding === 'br' ? unbrotli : unzip)(result.bytes), source);
      return result;
    }));
    assert.notEqual(compressed[0].headers.etag, compressed[1].headers.etag);
    gzipBytes += compressed[0].bytes.length; brotliBytes += compressed[1].bytes.length;
  }
  assert.equal(middleware.diagnostics().entries, 5); assert.equal(middleware.diagnostics().sourceReads, 5);
  assert.equal(middleware.diagnostics().compressions, 10); assert.ok(middleware.diagnostics().maxActiveJobs <= 2);
  t.diagnostic(JSON.stringify({ rawBytes, gzipBytes, brotliBytes }));
});

test('GET/HEAD conditional requests use representation-specific strong ETags', async t => {
  const { get } = await host(t), path = '/models/fox-guide.glb';
  const original = await get(path), gzip = await get(path, { 'Accept-Encoding': 'gzip' });
  assert.equal(original.headers['content-encoding'], undefined); assert.notEqual(original.headers.etag, gzip.headers.etag);
  const head = await get(path, { 'Accept-Encoding': 'gzip' }, 'HEAD');
  assert.equal(head.status, 200); assert.equal(head.bytes.length, 0);
  assert.equal(head.headers['content-length'], gzip.headers['content-length']);
  assert.equal(head.headers.etag, gzip.headers.etag); assert.equal(head.headers['content-encoding'], 'gzip');
  for (const conditional of [gzip.headers.etag, `"other", W/${gzip.headers.etag}`, '*']) {
    const cached = await get(path, { 'Accept-Encoding': 'gzip', 'If-None-Match': conditional });
    assert.equal(cached.status, 304); assert.equal(cached.bytes.length, 0); assert.equal(cached.headers.etag, gzip.headers.etag);
  }
  const cachedHead = await get(path, { 'Accept-Encoding': 'gzip', 'If-None-Match': gzip.headers.etag }, 'HEAD');
  assert.equal(cachedHead.status, 304); assert.equal(cachedHead.bytes.length, 0);
  const differentRepresentation = await get(path, { 'Accept-Encoding': 'gzip', 'If-None-Match': original.headers.etag });
  assert.equal(differentRepresentation.status, 200); assert.deepEqual(differentRepresentation.bytes, gzip.bytes);
});

test('Identity and wildcard exclusions work over HTTP; fetch automatically decodes the chosen transport', async t => {
  const { get, url } = await host(t), path = '/models/environment.glb';
  const source = await readFile(join(models, 'environment.glb'));
  const identity = await get(path, { 'Accept-Encoding': 'br;q=0, gzip;q=0' });
  assert.equal(identity.status, 200); assert.equal(identity.headers['content-encoding'], undefined); assert.deepEqual(identity.bytes, source);
  const gzip = await get(path, { 'Accept-Encoding': 'br;q=0, *;q=1' });
  assert.equal(gzip.headers['content-encoding'], 'gzip'); assert.deepEqual(await unzip(gzip.bytes), source);
  const rejected = await get(path, { 'Accept-Encoding': '*;q=0' });
  assert.equal(rejected.status, 406); assert.equal(rejected.bytes.length, 0); assert.equal(rejected.headers.vary, 'Accept-Encoding');
  const fetched = await fetch(`${url}${path}`, { headers: { 'Accept-Encoding': 'br, gzip' } });
  assert.equal(fetched.status, 200); assert.equal(fetched.headers.get('content-encoding'), 'br');
  assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), source);
});

test('Concurrent repeated requests deduplicate source/compression work within two jobs and five entries', async t => {
  const { get, middleware } = await host(t);
  const responses = await Promise.all(MODEL_FILES.flatMap(file => Array.from({ length: 4 }, () => get(`/models/${file}`, { 'Accept-Encoding': 'br' }))));
  for (let i = 0; i < MODEL_FILES.length; i++) {
    const subset = responses.slice(i * 4, i * 4 + 4); assert.ok(subset.every(result => result.status === 200));
    for (const result of subset) { assert.equal(result.headers.etag, subset[0].headers.etag); assert.deepEqual(result.bytes, subset[0].bytes); }
  }
  assert.deepEqual(middleware.diagnostics(), { entries: 5, activeJobs: 0, maxActiveJobs: 2, sourceReads: 5, compressions: 5 });
});

test('Range, methods, non-whitelisted/encoded/traversal paths and missing files defer to the existing server', async t => {
  const { get, middleware } = await host(t);
  const requests = [
    ['/models/math-world.glb', { Range: 'bytes=0-31', 'Accept-Encoding': 'br' }],
    ['/models/math-world.glb', {}, 'POST'], ['/models/other.glb'], ['/models/fox-guide-mobile.glb'],
    ['/models/math%2dworld.glb'], ['/models/../models/math-world.glb'], ['/models/math-world.glb/'],
  ];
  for (const args of requests) {
    const result = await get(...args); assert.equal(result.status, 404); assert.equal(result.headers['x-delegated'], '1');
    assert.equal(result.headers['content-encoding'], undefined);
  }
  assert.equal(middleware.diagnostics().entries, 0);
  const fixture = await temporary(t), empty = await host(t, fixture.directory);
  const missing = await empty.get('/models/fox-guide.glb', { 'Accept-Encoding': 'br' });
  assert.equal(missing.status, 404); assert.equal(missing.headers['x-delegated'], '1'); assert.equal(empty.middleware.diagnostics().entries, 0);
});

test('Same-size source edits invalidate mtime/ctime cache and re-encode current bytes', async t => {
  const fixture = await temporary(t), first = await readFile(join(models, 'fox-guide.glb'));
  const file = await fixture.put('fox-guide.glb', first), { get, middleware } = await host(t, fixture.directory);
  const before = await get('/models/fox-guide.glb', { 'Accept-Encoding': 'gzip' });
  const previous = await stat(file), second = Buffer.from(first); second[second.length - 1] ^= 1;
  await writeFile(file, second); await utimes(file, previous.atime, new Date(previous.mtimeMs + 2000));
  const after = await get('/models/fox-guide.glb', { 'Accept-Encoding': 'gzip', 'If-None-Match': before.headers.etag });
  assert.equal(after.status, 200); assert.notEqual(after.headers.etag, before.headers.etag); assert.deepEqual(await unzip(after.bytes), second);
  const previousAgain = await stat(file), third = Buffer.from(second); third[third.length - 2] ^= 1;
  await writeFile(file, third); await utimes(file, previousAgain.atime, previousAgain.mtime);
  const preservedMtime = await get('/models/fox-guide.glb', { 'Accept-Encoding': 'gzip', 'If-None-Match': after.headers.etag });
  assert.equal(preservedMtime.status, 200); assert.notEqual(preservedMtime.headers.etag, after.headers.etag);
  assert.deepEqual(await unzip(preservedMtime.bytes), third);
  assert.equal(middleware.diagnostics().entries, 1); assert.equal(middleware.diagnostics().sourceReads, 3); assert.equal(middleware.diagnostics().compressions, 3);
});

test('Vite hooks read dev public/models and preview build output/models independently', async t => {
  const fixture = await temporary(t);
  await fixture.put('public/models/math-world.glb', Buffer.from('dev-model-bytes'));
  await fixture.put('output/models/math-world.glb', Buffer.from('preview-model-bytes'));
  const plugin = modelTransportPlugin();
  plugin.configResolved({ root: fixture.directory, publicDir: join(fixture.directory, 'public'), build: { outDir: 'output' } });
  const handlers = [];
  const server = { middlewares: { use: middleware => handlers.push(middleware) } };
  plugin.configureServer(server); plugin.configurePreviewServer(server);
  assert.equal(handlers.length, 2);
  const listen = async middleware => {
    const native = createServer((req, res) => void middleware(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise(resolveListen => native.listen(0, '127.0.0.1', resolveListen));
    t.after(() => new Promise(resolveClose => native.close(resolveClose))); return `http://127.0.0.1:${native.address().port}/models/math-world.glb`;
  };
  assert.equal(await (await fetch(await listen(handlers[0]))).text(), 'dev-model-bytes');
  assert.equal(await (await fetch(await listen(handlers[1]))).text(), 'preview-model-bytes');
});
