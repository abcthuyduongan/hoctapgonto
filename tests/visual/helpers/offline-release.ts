import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeOfflineWorker } from '../../../tools/offlineBuild.mjs';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Add harmless GLB metadata while preserving every actual geometry/bin chunk. */
async function markModel(filename: string) {
  const bytes = await readFile(filename);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error('Fixture needs a valid GLB v2.');
  const chunks: Buffer[] = [];
  for (let offset = 12; offset < bytes.length;) {
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    let data = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) {
      const json = JSON.parse(data.toString('utf8').trim());
      json.asset.extras = { ...json.asset.extras, qaRelease: 'BA05-B' };
      const text = Buffer.from(JSON.stringify(json), 'utf8');
      data = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
      text.copy(data);
    }
    const header = Buffer.alloc(8);
    header.writeUInt32LE(data.length, 0); header.writeUInt32LE(type, 4);
    chunks.push(header, data);
    offset += size + 8;
  }
  const header = Buffer.from(bytes.subarray(0, 12));
  header.writeUInt32LE(12 + chunks.reduce((size, chunk) => size + chunk.length, 0), 8);
  await writeFile(filename, Buffer.concat([header, ...chunks]));
}

export async function createReleaseServer(outputRoot: string) {
  // Playwright output lives in the project. Verify this bounded absolute target
  // before fixture copies or recursive cleanup; never touch the source dist.
  const workspace = path.resolve(process.cwd()), fixture = path.resolve(outputRoot);
  const relative = path.relative(workspace, fixture);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Release fixture must stay inside this workspace.');
  const roots = { A: path.join(fixture, 'A'), B: path.join(fixture, 'B') };
  await mkdir(fixture, { recursive: true });
  await cp(path.join(workspace, 'dist'), roots.A, { recursive: true });
  await cp(path.join(workspace, 'dist'), roots.B, { recursive: true });
  const assets = await readdir(path.join(roots.B, 'assets'));
  const entry = assets.find(name => /^index-[^.]+\.js$/.test(name));
  const legacyApp = assets.find(name => /^App-[^.]+\.js$/.test(name));
  const oldChunk = assets.find(name => /^WordConnect-[^.]+\.js$/.test(name));
  if (!entry || !legacyApp || !oldChunk) throw new Error('Build snapshot must include the real entry, legacy App and WordConnect lazy chunks.');
  const replacement = (name: string) => name.replace(/\.js$/, '-qaB.js');
  for (const filename of assets.filter(name => name.endsWith('.js'))) {
    const location = path.join(roots.B, 'assets', filename);
    let text = await readFile(location, 'utf8');
    text = text.replaceAll(oldChunk, replacement(oldChunk)).replaceAll(entry, replacement(entry));
    if (filename === legacyApp) {
      const brandLiteral = '"BẢO AN"';
      if (text.split(brandLiteral).length !== 2) throw new Error('Built legacy App must have exactly one visible brand literal for release B.');
      text = text.replace(brandLiteral, '"BẢO AN QA B"');
    }
    await writeFile(location, text);
  }
  await rename(path.join(roots.B, 'assets', entry), path.join(roots.B, 'assets', replacement(entry)));
  await rename(path.join(roots.B, 'assets', oldChunk), path.join(roots.B, 'assets', replacement(oldChunk)));
  const html = await readFile(path.join(roots.B, 'index.html'), 'utf8');
  await writeFile(path.join(roots.B, 'index.html'), html.replaceAll(entry, replacement(entry)));
  await markModel(path.join(roots.B, 'models', 'math-world.glb'));
  await writeOfflineWorker(roots.A);
  await writeOfflineWorker(roots.B);
  const aChunkPath = `/assets/${oldChunk}`;
  const aChunkHash = digest(await readFile(path.join(roots.A, 'assets', oldChunk)));
  const bModelHash = digest(await readFile(path.join(roots.B, 'models', 'math-world.glb')));
  const lazyFiles = assets.filter(name => /^(MathQuest|MemoryMatch|SentenceBuilder|WordConnect|SequenceTrail|TimesTable|LearningProfileBackup|LearningScreen|ParentLearningPanel|ContestScreen|RewardWalletPanel|QuestionTemplatePanel)-.*\.js$/.test(name));
  let release: 'A' | 'B' = 'A';
  let failedChunk: string | null = null;
  const served: string[] = [];
  const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    served.push(pathname);
    if (failedChunk && pathname.includes(failedChunk)) { response.writeHead(503, { 'Cache-Control': 'no-store' }); response.end('Injected lazy chunk outage'); return; }
    const root = roots[release];
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : decodeURIComponent(pathname)}`);
    if (path.relative(root, filename).startsWith('..')) { response.writeHead(403); response.end(); return; }
    try {
      const info = await stat(filename);
      if (!info.isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': info.size });
      response.end(await readFile(filename));
    } catch { response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end('Fixture resource missing'); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture did not obtain a local port.');
  return {
    origin: `http://127.0.0.1:${address.port}`, aChunkPath, aChunkHash, bModelHash, lazyFiles, served,
    switchToB: () => { release = 'B'; },
    failChunk: (name: string | null) => { failedChunk = name; },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await rm(fixture, { recursive: true, force: true });
    },
  };
}
