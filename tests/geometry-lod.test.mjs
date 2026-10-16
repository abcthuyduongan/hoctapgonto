import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BufferGeometry, BufferAttribute, Mesh, Group, SkinnedMesh, MeshStandardMaterial,
  Texture, Box3, Vector3, Raycaster, SphereGeometry } from 'three';
import { createGeometryLod } from '../src/world3d/scenes/geometryLod.ts';

// Read the shipped GLB geometry, indices and node transforms without an image or
// GPU shim. Texture objects model ownership; texture decoding has its own tests.
function asset(name) {
  const bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  const size = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + size));
  const binary = bytes.subarray(28 + size);
  const components = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const items = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const attribute = id => {
    const accessor = json.accessors[id], view = json.bufferViews[accessor.bufferView];
    const Constructor = components[accessor.componentType], itemSize = items[accessor.type];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    assert.ok(!view.byteStride, 'authored asset stores tightly packed accessors');
    const data = binary.subarray(start, start + accessor.count * itemSize * Constructor.BYTES_PER_ELEMENT);
    return new BufferAttribute(new Constructor(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)), itemSize, accessor.normalized ?? false);
  };
  const materials = json.materials.map(definition => {
    const material = new MeshStandardMaterial(); material.name = definition.name;
    for (const channel of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) material[channel] = new Texture();
    return material;
  });
  const meshes = [];
  const nodes = json.nodes.map(definition => {
    const node = new Group(); node.name = definition.name ?? '';
    if (definition.matrix) node.applyMatrix4(node.matrix.fromArray(definition.matrix));
    if (definition.translation) node.position.fromArray(definition.translation);
    if (definition.rotation) node.quaternion.fromArray(definition.rotation);
    if (definition.scale) node.scale.fromArray(definition.scale);
    if (definition.mesh !== undefined) for (const primitive of json.meshes[definition.mesh].primitives) {
      const geometry = new BufferGeometry();
      const names = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };
      for (const [semantic, accessor] of Object.entries(primitive.attributes)) geometry.setAttribute(names[semantic] ?? semantic, attribute(accessor));
      if (primitive.indices !== undefined) geometry.setIndex(attribute(primitive.indices));
      const Constructor = definition.skin === undefined ? Mesh : SkinnedMesh;
      const mesh = new Constructor(geometry, materials[primitive.material]); mesh.name = node.name;
      meshes.push(mesh); node.add(mesh);
    }
    return node;
  });
  json.nodes.forEach((definition, index) => (definition.children ?? []).forEach(child => nodes[index].add(nodes[child])));
  const root = new Group(); json.scenes[json.scene ?? 0].nodes.forEach(index => root.add(nodes[index])); root.updateMatrixWorld(true);
  return { root, meshes, bytes };
}
const count = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;
const fingerprint = geometry => createHash('sha256').update(JSON.stringify({
  index: [...(geometry.index?.array ?? [])],
  attrs: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, [...attribute.array]])),
})).digest('hex');
function verifyGeometry(geometry) {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  assert.ok(position && normal && uv);
  assert.equal(normal.count, position.count); assert.equal(uv.count, position.count);
  assert.ok([...position.array, ...normal.array, ...uv.array].every(Number.isFinite));
  assert.ok(geometry.index.count > 0 && geometry.index.count % 3 === 0);
  assert.ok([...geometry.index.array].every(index => Number.isInteger(index) && index >= 0 && index < position.count));
  for (let i = 0; i < normal.count; i++) assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < .002);
}
const assets = ['math-world', 'memory-world', 'language-world', 'environment'];

test('Shipped static islands/environment reduce real triangles with finite indexed normal/UV data', async t => {
  const fixtures = assets.map(asset), roots = fixtures.map(fixture => fixture.root);
  const before = fixtures.map(fixture => new Box3().setFromObject(fixture.root));
  const originals = fixtures.flatMap(fixture => fixture.meshes).map(mesh => ({ mesh, geometry: mesh.geometry, hash: fingerprint(mesh.geometry), material: mesh.material,
    maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap'].map(channel => mesh.material[channel]) }));
  const lod = await createGeometryLod(roots); lod.setEnabled(true);
  const islandSource = fixtures.slice(0, 3).flatMap(fixture => fixture.meshes).reduce((sum, mesh) => sum + count(originals.find(item => item.mesh === mesh).geometry), 0);
  const islandLow = fixtures.slice(0, 3).flatMap(fixture => fixture.meshes).reduce((sum, mesh) => sum + count(mesh.geometry), 0);
  assert.ok(islandLow <= islandSource * .75, `islands ${islandSource} → ${islandLow}: at least 25% reduction`);
  assert.ok(lod.stats.lowTriangles < lod.stats.sourceTriangles * .8);
  assert.ok(lod.stats.simplifiedGeometries > 10);
  for (const { mesh, geometry, hash, material, maps } of originals) {
    verifyGeometry(mesh.geometry); assert.equal(fingerprint(geometry), hash, 'master geometry stays byte-equivalent');
    assert.equal(mesh.material, material);
    assert.deepEqual(['map', 'normalMap', 'roughnessMap', 'metalnessMap'].map(channel => mesh.material[channel]), maps);
    // Simplification references exact welded source attributes, avoiding invented
    // normals, UV extrapolation or interpolation across hard seams.
    const tuples = new Set();
    for (let i = 0; i < geometry.attributes.position.count; i++) tuples.add(['position', 'normal', 'uv'].flatMap(name => {
      const attr = geometry.attributes[name]; return Array.from({ length: attr.itemSize }, (_, k) => attr.getComponent(i, k));
    }).join(','));
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) assert.ok(tuples.has(['position', 'normal', 'uv'].flatMap(name => {
      const attr = mesh.geometry.attributes[name]; return Array.from({ length: attr.itemSize }, (_, k) => attr.getComponent(i, k));
    }).join(',')), 'retained vertices have their exact source shading/UV tuple');
  }
  fixtures.forEach((fixture, i) => {
    const after = new Box3().setFromObject(fixture.root), tolerance = i === 3 ? .7 : .05;
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Math.abs(after.min[axis] - before[i].min[axis]) <= tolerance, `${assets[i]} min ${axis} silhouette`);
      assert.ok(Math.abs(after.max[axis] - before[i].max[axis]) <= tolerance, `${assets[i]} max ${axis} silhouette`);
    }
  });
  t.diagnostic(JSON.stringify({ ...lod.stats, islandSource, islandLow }));
  lod.disposeOwnedGeometries();
});

test('Authored landing spots and island raycasting survive low-detail geometry', async () => {
  const fixtures = assets.slice(0, 3).map(asset), landings = [[-1.14, 1.12], [-.95, 1.25], [.95, 1.05]];
  const raycaster = new Raycaster();
  const sample = (root, x, z) => {
    root.updateMatrixWorld(true); raycaster.set(new Vector3(x, 5, z), new Vector3(0, -1, 0));
    return raycaster.intersectObject(root, true)[0];
  };
  const originalHits = fixtures.map((fixture, i) => sample(fixture.root, ...landings[i]));
  const lod = await createGeometryLod(fixtures.map(fixture => fixture.root)); lod.setEnabled(true);
  fixtures.forEach((fixture, i) => {
    const hit = sample(fixture.root, ...landings[i]);
    assert.ok(originalHits[i] && hit, `${assets[i]} landing has an intersectable surface`);
    assert.ok(hit.point.distanceTo(originalHits[i].point) < .025, `${assets[i]} ground stays at the landing spot`);
  });
  lod.disposeOwnedGeometries();
});

test('Quality switches reuse cached geometries; disposal restores masters and releases only owned LODs once', async () => {
  const fixture = asset('math-world'), originals = fixture.meshes.map(mesh => mesh.geometry);
  const lod = await createGeometryLod([fixture.root]); lod.setEnabled(true);
  const reduced = fixture.meshes.map(mesh => mesh.geometry), owned = new Set(reduced.filter((geometry, i) => geometry !== originals[i]));
  let originalDisposed = 0, lodDisposed = 0, materialDisposed = 0, textureDisposed = 0;
  originals.forEach(geometry => geometry.addEventListener('dispose', () => originalDisposed++));
  owned.forEach(geometry => geometry.addEventListener('dispose', () => lodDisposed++));
  fixture.meshes.forEach(mesh => { mesh.material.addEventListener('dispose', () => materialDisposed++); mesh.material.map.addEventListener('dispose', () => textureDisposed++); });
  for (let i = 0; i < 20; i++) {
    lod.setEnabled(false); assert.deepEqual(fixture.meshes.map(mesh => mesh.geometry), originals);
    lod.setEnabled(true); assert.deepEqual(fixture.meshes.map(mesh => mesh.geometry), reduced);
  }
  lod.disposeOwnedGeometries(); lod.disposeOwnedGeometries(); lod.setEnabled(true);
  assert.deepEqual(fixture.meshes.map(mesh => mesh.geometry), originals);
  assert.equal(lodDisposed, owned.size); assert.equal(originalDisposed, 0); assert.equal(materialDisposed, 0); assert.equal(textureDisposed, 0);
});

test('Fox skin/morphs, explicitly excluded platforms, small details, and shared masters are safe', async () => {
  const root = new Group(), material = new MeshStandardMaterial();
  const shared = new SphereGeometry(1, 36, 20), first = new Mesh(shared, material), second = new Mesh(shared, material);
  const platform = new Mesh(new SphereGeometry(1, 24, 16), material); platform.userData.noGeometryLod = true;
  const skin = new SkinnedMesh(new SphereGeometry(1, 24, 16), material);
  const morph = new Mesh(new SphereGeometry(1, 24, 16), material); morph.geometry.morphAttributes.position = [morph.geometry.getAttribute('position').clone()];
  const small = new Mesh(new SphereGeometry(1, 5, 4), material);
  root.add(first, second, platform, skin, morph, small);
  const untouched = [platform, skin, morph, small].map(mesh => mesh.geometry);
  const fox = asset('fox-guide'), foxOriginal = fox.meshes.map(mesh => mesh.geometry);
  const lod = await createGeometryLod([root, fox.root]); lod.setEnabled(true);
  assert.notEqual(first.geometry, shared); assert.equal(first.geometry, second.geometry);
  assert.deepEqual([platform, skin, morph, small].map(mesh => mesh.geometry), untouched);
  assert.deepEqual(fox.meshes.map(mesh => mesh.geometry), foxOriginal);
  assert.equal(lod.stats.simplifiedGeometries, 1);
  lod.disposeOwnedGeometries(); assert.equal(first.geometry, shared); assert.equal(second.geometry, shared);
});

test('Initialization yields to the host and releases its cache when unmount aborts midway', async t => {
  const root = new Group(), material = new MeshStandardMaterial();
  for (let i = 0; i < 3; i++) root.add(new Mesh(new SphereGeometry(1, 36, 20), material));
  const originals = root.children.map(mesh => mesh.geometry), disposed = new Map();
  const nativeDispose = BufferGeometry.prototype.dispose;
  t.mock.method(BufferGeometry.prototype, 'dispose', function () {
    disposed.set(this, (disposed.get(this) ?? 0) + 1); return nativeDispose.call(this);
  });
  const controller = new AbortController();
  let hostTurnRan = false;
  const timer = setTimeout(() => {
    hostTurnRan = true;
    // The scene owner may already release the masters during an unmount.
    originals.forEach(geometry => geometry.dispose()); controller.abort();
  }, 0);
  await assert.rejects(createGeometryLod([root], controller.signal), { name: 'AbortError' });
  clearTimeout(timer);
  assert.ok(hostTurnRan); assert.deepEqual(root.children.map(mesh => mesh.geometry), originals);
  const owned = [...disposed.keys()].filter(geometry => geometry.name.endsWith('low detail'));
  assert.ok(owned.length > 0, 'at least one cache geometry was prepared before the host aborted');
  for (const geometry of [...owned, ...originals]) assert.equal(disposed.get(geometry), 1);
});

test('Already aborted initialization does not touch source geometry or allocate a cache', async t => {
  const fixture = asset('math-world'), controller = new AbortController(); controller.abort();
  let disposed = 0;
  t.mock.method(BufferGeometry.prototype, 'dispose', () => disposed++);
  const originals = fixture.meshes.map(mesh => mesh.geometry);
  await assert.rejects(createGeometryLod([fixture.root], controller.signal), { name: 'AbortError' });
  assert.deepEqual(fixture.meshes.map(mesh => mesh.geometry), originals); assert.equal(disposed, 0);
});
