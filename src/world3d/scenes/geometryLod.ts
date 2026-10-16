import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
// The simplifier is bundled by Three; its declaration is not yet in @types/three.
// @ts-expect-error Three's official meshoptimizer module has no declaration yet.
import { MeshoptSimplifier as meshopt } from 'three/addons/libs/meshopt_simplifier.module.js';

interface Simplifier {
  supported: boolean;
  ready: Promise<void>;
  simplifyWithAttributes(indices: Uint32Array, positions: Float32Array, stride: number,
    attributes: Float32Array, attributeStride: number, weights: number[], locks: Uint8Array | null,
    target: number, error: number, flags?: string[]): [Uint32Array, number];
  compactMesh(indices: Uint32Array): [Uint32Array, number];
}
const simplifier = meshopt as Simplifier;

export interface GeometryLodStats {
  sourceTriangles: number;
  lowTriangles: number;
  simplifiedGeometries: number;
  preparationMs: number;
  cpuPreparationMs: number;
  maxMeshPreparationMs: number;
}
export interface GeometryLod {
  readonly stats: Readonly<GeometryLodStats>;
  setEnabled(enabled: boolean): void;
  /** Restores originals first. The scene owner retains every original resource. */
  disposeOwnedGeometries(): void;
}

function triangles(geometry: BufferGeometry) {
  return (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3;
}

function prepareLowGeometry(original: BufferGeometry): BufferGeometry | undefined {
  const sourcePosition = original.getAttribute('position');
  if (!sourcePosition || sourcePosition.itemSize !== 3 || triangles(original) < 80) return;
  // Exact shading/UV seams stay separate. Welding enables edge collapses in
  // the densely subdivided authored meshes, including indexed flat surfaces.
  const welded = mergeVertices(original, 1e-6);
  let result: BufferGeometry | undefined;
  try {
    const position = welded.getAttribute('position');
    const normal = welded.getAttribute('normal'), uv = welded.getAttribute('uv');
    const sourceIndex = welded.index;
    if (!sourceIndex || !normal || !uv) return;
    const positions = new Float32Array(position.count * 3);
    const attributes = new Float32Array(position.count * 5);
    for (let i = 0; i < position.count; i++) {
      positions[i * 3] = position.getX(i); positions[i * 3 + 1] = position.getY(i); positions[i * 3 + 2] = position.getZ(i);
      attributes[i * 5] = normal.getX(i); attributes[i * 5 + 1] = normal.getY(i); attributes[i * 5 + 2] = normal.getZ(i);
      attributes[i * 5 + 3] = uv.getX(i); attributes[i * 5 + 4] = uv.getY(i);
    }
    const index = new Uint32Array(sourceIndex.count);
    for (let i = 0; i < index.length; i++) index[i] = sourceIndex.getX(i);
    const target = Math.max(3, Math.floor(index.length * .5 / 3) * 3);
    // Request a one-percent relative error budget. Normals and UVs contribute
    // to that metric, and open boundaries remain locked.
    const [indices] = simplifier.simplifyWithAttributes(index, positions, 3, attributes, 5,
      [.1, .1, .1, .1, .1], null, target, .01, ['LockBorder']);
    if (indices.length >= index.length * .98) return;
    const [remap, count] = simplifier.compactMesh(indices);
    result = new BufferGeometry();
    for (const name of Object.keys(welded.attributes)) {
      const attribute = welded.getAttribute(name);
      const buffer = new Float32Array(count * attribute.itemSize);
      for (let vertex = 0; vertex < remap.length; vertex++) {
        if (remap[vertex] === 0xffffffff) continue;
        for (let k = 0; k < attribute.itemSize; k++) buffer[remap[vertex] * attribute.itemSize + k] = attribute.getComponent(vertex, k);
      }
      result.setAttribute(name, new BufferAttribute(buffer, attribute.itemSize));
    }
    result.setIndex(new BufferAttribute(indices, 1));
    result.name = `${original.name || 'authored geometry'} low detail`;
    result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
  } catch (error) {
    result?.dispose(); throw error;
  } finally {
    welded.dispose();
  }
}

/**
 * Prepare one cached lower detail geometry per static source. This never alters
 * materials, textures, transforms, skeletons or the original BufferGeometry.
 * Pass only island/environment roots; characters and their platforms are excluded.
 */
export async function createGeometryLod(roots: readonly Object3D[], signal?: AbortSignal): Promise<GeometryLod> {
  const started = performance.now();
  signal?.throwIfAborted();
  const meshes = new Set<Mesh>();
  for (const root of roots) root.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || 'isSkinnedMesh' in mesh || mesh.userData.noGeometryLod) return;
    const geometry = mesh.geometry;
    if (geometry.morphAttributes.position?.length || geometry.hasAttribute('skinWeight') ||
      geometry.hasAttribute('skinIndex') || Array.isArray(mesh.material) || geometry.groups.length > 1 ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return;
    meshes.add(mesh);
  });
  const originals = new Map([...meshes].map(mesh => [mesh, mesh.geometry]));
  const low = new Map<BufferGeometry, BufferGeometry>();
  let cpuPreparationMs = 0, maxMeshPreparationMs = 0;
  try {
    if (simplifier.supported) {
      await simplifier.ready;
      signal?.throwIfAborted();
      for (const original of new Set(originals.values())) {
        signal?.throwIfAborted();
        const meshStarted = performance.now();
        const result = prepareLowGeometry(original);
        if (result) low.set(original, result);
        const meshMs = performance.now() - meshStarted;
        cpuPreparationMs += meshMs; maxMeshPreparationMs = Math.max(maxMeshPreparationMs, meshMs);
        // Return to the host between meshes: input, tab suspension and unmount
        // can run while the initial cache is prepared, before it is ever attached.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    signal?.throwIfAborted();
  } catch (error) {
    for (const geometry of low.values()) geometry.dispose();
    throw error;
  }
  const stats: GeometryLodStats = {
    sourceTriangles: [...originals.values()].reduce((sum, geometry) => sum + triangles(geometry), 0),
    lowTriangles: [...originals.values()].reduce((sum, geometry) => sum + triangles(low.get(geometry) ?? geometry), 0),
    simplifiedGeometries: low.size,
    preparationMs: performance.now() - started,
    cpuPreparationMs,
    maxMeshPreparationMs,
  };
  let disposed = false;
  return {
    stats: Object.freeze(stats),
    setEnabled(enabled) {
      if (disposed) return;
      for (const [mesh, original] of originals) mesh.geometry = enabled ? low.get(original) ?? original : original;
    },
    disposeOwnedGeometries() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, original] of originals) mesh.geometry = original;
      for (const geometry of low.values()) geometry.dispose();
      low.clear(); originals.clear();
    },
  };
}
