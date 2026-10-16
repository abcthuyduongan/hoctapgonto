import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip, brotliCompress, constants } from 'node:zlib';

const gzipAsync = promisify(gzip), brotliAsync = promisify(brotliCompress);
export const MODEL_FILES = Object.freeze([
  'fox-guide.glb', 'math-world.glb', 'memory-world.glb', 'language-world.glb', 'environment.glb',
]);
const paths = new Map(MODEL_FILES.map(file => [`/models/${file}`, file]));

/** Equal preferences choose Brotli first; omitted identity remains a fallback. */
export function negotiateModelEncoding(header) {
  if (!header?.trim()) return 'identity';
  const weights = new Map();
  for (const item of header.split(',')) {
    const [token, ...parameters] = item.trim().toLowerCase().split(';');
    if (!token.trim()) continue;
    let weight = 1;
    for (const parameter of parameters) {
      const [name, value] = parameter.trim().split('=').map(value => value.trim());
      if (name !== 'q') continue;
      weight = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value ?? '') ? Number(value) : 0;
    }
    weights.set(token.trim(), weight);
  }
  const quality = encoding => weights.get(encoding) ?? weights.get('*') ?? 0;
  const supported = ['br', 'gzip'];
  if (weights.has('identity')) supported.push('identity');
  supported.sort((a, b) => quality(b) - quality(a));
  const best = supported.find(encoding => quality(encoding) > 0);
  if (best) return best;
  return weights.get('identity') !== 0 && weights.get('*') !== 0 ? 'identity' : null;
}

function varyEncoding(response) {
  const current = response.getHeader('Vary');
  const values = (Array.isArray(current) ? current.join(',') : String(current ?? '')).split(',').map(value => value.trim()).filter(Boolean);
  if (!values.some(value => value === '*' || value.toLowerCase() === 'accept-encoding')) values.push('Accept-Encoding');
  response.setHeader('Vary', values.join(', '));
}
function representation(bytes, encoding) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return { bytes, etag: `"baoan-${encoding}-${hash}"` };
}
function matchesEtag(header, etag) {
  return String(header ?? '').split(',').some(value => {
    const tag = value.trim(); return tag === '*' || tag.replace(/^W\//, '') === etag;
  });
}
const missing = error => error?.code === 'ENOENT' || error?.code === 'ENOTDIR';

/**
 * Five bounded source entries, deduplicated pending reads/representations, and
 * two concurrent async filesystem/compression jobs. Master files remain intact.
 */
export function createModelTransportMiddleware({ modelDir }) {
  const directory = resolve(modelDir), cache = new Map(), waiting = [];
  let activeJobs = 0, maxActiveJobs = 0, sourceReads = 0, compressions = 0;
  const run = async operation => {
    if (activeJobs >= 2) await new Promise(resolveWait => waiting.push(resolveWait));
    else activeJobs++;
    maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
    try { return await operation(); }
    finally {
      // Transfer an occupied permit directly to the next waiter so a new
      // request cannot steal it before that waiter's continuation runs.
      const release = waiting.shift(); if (release) release(); else activeJobs--;
    }
  };
  const source = (entry, file) => {
    if (!entry.source) {
      const promise = run(async () => { sourceReads++; return representation(await readFile(file), 'identity'); });
      entry.source = promise;
      promise.catch(() => { if (entry.source === promise) entry.source = undefined; });
    }
    return entry.source;
  };
  const encoded = (entry, file, encoding) => {
    if (encoding === 'identity') return source(entry, file);
    if (!entry.variants.has(encoding)) {
      const promise = (async () => {
        const original = await source(entry, file);
        return run(async () => {
          compressions++;
          const bytes = encoding === 'br'
            ? await brotliAsync(original.bytes, { params: {
              [constants.BROTLI_PARAM_QUALITY]: 5,
              [constants.BROTLI_PARAM_SIZE_HINT]: original.bytes.length,
            } })
            : await gzipAsync(original.bytes, { level: 6 });
          return representation(bytes, encoding);
        });
      })();
      entry.variants.set(encoding, promise);
      promise.catch(() => { if (entry.variants.get(encoding) === promise) entry.variants.delete(encoding); });
    }
    return entry.variants.get(encoding);
  };
  const middleware = async (request, response, next) => {
    const pathname = String(request.url ?? '').split('?')[0], filename = paths.get(pathname);
    if (!filename || !['GET', 'HEAD'].includes(request.method) || request.headers.range !== undefined) { next(); return; }
    try {
      const file = join(directory, filename), metadata = await stat(file, { bigint: true });
      if (!metadata.isFile()) { next(); return; }
      // Nanosecond timestamps invalidate same-length replacements; ctime also
      // catches replacements that deliberately preserve their previous mtime.
      const signature = `${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}`;
      let entry = cache.get(filename);
      if (!entry || entry.signature !== signature) {
        entry = { signature, source: undefined, variants: new Map() }; cache.set(filename, entry);
      }
      const accept = request.headers['accept-encoding'];
      const encoding = negotiateModelEncoding(Array.isArray(accept) ? accept.join(',') : accept);
      varyEncoding(response);
      if (!encoding) { response.statusCode = 406; response.end(); return; }
      const result = await encoded(entry, file, encoding);
      if (response.destroyed) return;
      response.setHeader('Content-Type', 'model/gltf-binary');
      response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      response.setHeader('ETag', result.etag);
      response.setHeader('Content-Length', result.bytes.length);
      if (encoding !== 'identity') response.setHeader('Content-Encoding', encoding);
      else response.removeHeader('Content-Encoding');
      if (matchesEtag(request.headers['if-none-match'], result.etag)) {
        response.statusCode = 304; response.end(); return;
      }
      response.statusCode = 200;
      response.end(request.method === 'HEAD' ? undefined : result.bytes);
    } catch (error) {
      if (missing(error)) next(); else next(error);
    }
  };
  middleware.diagnostics = () => Object.freeze({ entries: cache.size, activeJobs, maxActiveJobs, sourceReads, compressions });
  return middleware;
}

/** @returns {import('vite').Plugin} */
export function modelTransportPlugin() {
  let devModels, previewModels;
  return {
    name: 'bao-an-model-transport',
    configResolved(config) {
      devModels = config.publicDir ? join(config.publicDir, 'models') : undefined;
      previewModels = resolve(config.root, config.build.outDir, 'models');
    },
    configureServer(server) {
      if (devModels) server.middlewares.use(createModelTransportMiddleware({ modelDir: devModels }));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createModelTransportMiddleware({ modelDir: previewModels }));
    },
  };
}
