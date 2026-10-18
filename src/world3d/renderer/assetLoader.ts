import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { MeshStandardMaterial } from 'three';
import { disposeScene } from './disposeScene.ts';

/** A renderer owns its assets. No global GPU cache survives disposal. */
export class AssetLoader {
  private loader = new GLTFLoader();
  private pending = new Map<string, Promise<GLTF>>();
  private signal: AbortSignal;
  private timeoutMs: number;
  constructor(signal: AbortSignal, timeoutMs = 15_000) { this.signal = signal; this.timeoutMs = timeoutMs; }
  load(path: string): Promise<GLTF> {
    const existing = this.pending.get(path);
    if (existing) return existing;
    const promise = this.fetchAndParse(path);
    this.pending.set(path, promise);
    return promise;
  }
  private async fetchAndParse(path: string) {
    this.signal.throwIfAborted();
    const timeout = new AbortController();
    const signal = AbortSignal.any([this.signal, timeout.signal]);
    const timer = setTimeout(() => timeout.abort(new DOMException('Tải cảnh quá lâu. Đang chuyển sang cảnh nhẹ.', 'TimeoutError')), this.timeoutMs);
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(path, { signal });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      bytes = await response.arrayBuffer();
    } finally { clearTimeout(timer); }
    this.signal.throwIfAborted();
    // Self-contained GLB only, no remote URIs or decoder dependencies.
    if (bytes.byteLength < 20 || bytes.byteLength > 16 * 1024 * 1024) throw new Error(`${path}: kích thước GLB không hợp lệ`);
    const view = new DataView(bytes);
    if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error(`${path}: không phải GLB 2.0`);
    const jsonLength = view.getUint32(12, true);
    if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) throw new Error(`${path}: JSON không hợp lệ`);
    const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
    if ([...(json.buffers ?? []), ...(json.images ?? [])].some((item: { uri?: string }) => item.uri)) {
      throw new Error(`${path}: GLB phải chứa tài nguyên bên trong`);
    }
    const result = await this.loader.parseAsync(bytes, '');
    try {
      this.signal.throwIfAborted();
      // GLTFLoader can resolve successfully when an image fails to decode.
      // Declared PBR maps must actually exist before an asset is called ready.
      const materials = await result.parser.getDependencies('material') as MeshStandardMaterial[];
      const valid = (json.materials ?? []).every((source: {
        pbrMetallicRoughness?: { baseColorTexture?: unknown; metallicRoughnessTexture?: unknown };
        normalTexture?: unknown; emissiveTexture?: unknown; occlusionTexture?: unknown;
      }, index: number) => {
        const material = materials[index];
        return material && (!source.pbrMetallicRoughness?.baseColorTexture || material.map)
          && (!source.pbrMetallicRoughness?.metallicRoughnessTexture || (material.roughnessMap && material.metalnessMap))
          && (!source.normalTexture || material.normalMap)
          && (!source.emissiveTexture || material.emissiveMap)
          && (!source.occlusionTexture || material.aoMap);
      });
      if (!valid) throw new Error(`${path}: texture PBR không giải mã được`);
      this.signal.throwIfAborted();
      return result;
    } catch (error) {
      result.scenes.forEach(disposeScene);
      throw error;
    }
  }
}
