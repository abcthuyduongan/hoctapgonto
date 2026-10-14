import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

/** Limit simultaneous network/decode work while retaining every result for cleanup. */
export async function loadCatalog(paths: readonly string[], load: (path: string) => Promise<GLTF>, signal: AbortSignal) {
  const results: PromiseSettledResult<GLTF>[] = new Array(paths.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < paths.length) {
      const index = cursor++;
      try {
        signal.throwIfAborted();
        results[index] = { status: 'fulfilled', value: await load(paths[index]) };
      } catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  };
  await Promise.all([worker(), worker()]);
  return results;
}
