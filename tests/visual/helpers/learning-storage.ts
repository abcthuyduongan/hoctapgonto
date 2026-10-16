import { createServer } from 'node:http';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

/** Production UI and the separately compiled core share a real browser origin. */
export async function createLearningStorageServer(outputRoot: string) {
  const workspace = path.resolve(process.cwd());
  const fixture = path.resolve(outputRoot);
  const allowedRoot = path.join(workspace, 'test-results');
  const relative = path.relative(allowedRoot, fixture);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Learning storage fixture must stay inside workspace/test-results.');
  }
  const harness = path.join(fixture, 'harness');
  await mkdir(fixture, { recursive: true });
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: harness,
      emptyOutDir: true,
      minify: false,
      lib: {
        entry: path.join(workspace, 'tests', 'visual', 'helpers', 'learning-storage-entry.ts'),
        formats: ['es'],
        fileName: () => 'storage.js',
      },
    },
  });
  const production = path.join(workspace, 'dist');
  const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary',
    '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname === '/qa-fixture') {
      response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' });
      response.end('<!doctype html><title>Learning storage migration fixture</title>');
      return;
    }
    if (pathname === '/qa-storage') {
      response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' });
      response.end('<!doctype html><title>Production storage adapter</title><script type="module">import * as core from "/qa/storage.js"; window.__learningStorage = core;</script>');
      return;
    }
    const root = pathname.startsWith('/qa/') ? harness : production;
    const filePath = pathname.startsWith('/qa/') ? pathname.slice(3) : pathname === '/' ? '/index.html' : pathname;
    const filename = path.resolve(root, `.${decodeURIComponent(filePath)}`);
    const fileRelative = path.relative(root, filename);
    if (fileRelative.startsWith('..') || path.isAbsolute(fileRelative)) {
      response.writeHead(403); response.end(); return;
    }
    try {
      const info = await stat(filename);
      if (!info.isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': info.size });
      response.end(await readFile(filename));
    } catch {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end('Learning storage fixture resource missing');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Learning storage fixture did not obtain a local port.');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      // fixture was resolved and bounded to test-results before any writes.
      await rm(fixture, { recursive: true, force: true });
    },
  };
}
