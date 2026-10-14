import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Texture, InstancedMesh } from 'three';
import { buildGameEnvironments, GAME_WORLD_MATERIAL_NAMES } from '../src/world3d/scenes/gameEnvironments.ts';
const sources = { 'math-quest': 'math-world', 'memory-match': 'memory-world', 'sentence-builder': 'language-world' };
function fixture(id) {
  const source = new Group(), materials = new Map(), texture = new Texture();
  for (const [index, name] of [...new Set(Object.values(GAME_WORLD_MATERIAL_NAMES[id]))].entries()) {
    const material = new MeshStandardMaterial({ color: 0x508061 + index * 256, map: texture, normalMap: texture, roughnessMap: texture });
    material.name = name; materials.set(name, material); source.add(new Mesh(new BoxGeometry(.1, .1, .1), material));
  }
  return { source, materials, texture };
}
function collect(root, predicate) { const matches = []; root.traverse(node => { if (predicate(node)) matches.push(node); }); return matches; }
test('Every explicit foreground role exists in all three shipped GLBs with embedded PBR', () => {
  for (const [id, file] of Object.entries(sources)) {
    const binary = fs.readFileSync(`public/models/${file}.glb`);
    const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString());
    const materials = new Map(gltf.materials.map(material => [material.name, material]));
    for (const [role, name] of Object.entries(GAME_WORLD_MATERIAL_NAMES[id])) {
      const material = materials.get(name); assert.ok(material, `${id}/${role}: ${name} must exist`);
      assert.ok(material.pbrMetallicRoughness.baseColorTexture && material.normalTexture && material.pbrMetallicRoughness.metallicRoughnessTexture,
        `${id}/${role}: authored PBR channels must be available`);
    }
  }
});
test('Foreground reuses decoded materials/maps; world switches never tint source materials', () => {
  const scene = buildGameEnvironments(), colors = [];
  for (const id of Object.keys(sources)) {
    const { source, materials, texture } = fixture(id);
    const before = new Map([...materials].map(([name, material]) => [name, material.color.clone()]));
    assert.deepEqual(scene.applyWorldMaterials(id, source).missing, []); scene.setWorld(id); scene.setQuality(true);
    const selected = collect(scene.root, node => node.isMesh && node.userData.gameMaterialRole).filter(mesh => {
      let node = mesh.parent; while (node && !node.name.includes('scenic interior')) node = node.parent; return node?.name.startsWith(id);
    });
    for (const mesh of selected) { assert.equal(mesh.material, materials.get(GAME_WORLD_MATERIAL_NAMES[id][mesh.userData.gameMaterialRole])); assert.equal(mesh.material.map, texture); }
    assert.equal(scene.root.getObjectByName('PBR continuous meadow foreground').material, materials.get(GAME_WORLD_MATERIAL_NAMES[id].lawn));
    const hills = scene.root.getObjectByName('Soft distant sage hills');
    assert.notEqual(hills.material, materials.get(GAME_WORLD_MATERIAL_NAMES[id].leaf)); assert.equal(hills.material.map, texture); colors.push({ materials, before });
  }
  for (const id of [...Object.keys(sources), null, ...Object.keys(sources)]) scene.setWorld(id);
  for (const { materials, before } of colors) for (const [name, material] of materials) assert.ok(material.color.equals(before.get(name)));
  scene.dispose();
});
test('Lobed crowns, branches and roots remain instanced within a light tree budget', () => {
  const scene = buildGameEnvironments(); scene.setWorld('memory-match');
  const forest = scene.root.getObjectByName('memory-match scenic interior');
  const timber = collect(forest, node => node instanceof InstancedMesh && node.userData.gameMaterialRole === 'bark');
  const crowns = collect(forest, node => node instanceof InstancedMesh && node.userData.gameMaterialRole === 'leaf');
  assert.equal(timber.length, 1); assert.equal(crowns.length, 1); assert.equal(timber[0].count, 8 * 7); assert.equal(crowns[0].count, 8 * 6);
  const triangles = timber[0].geometry.index.count / 3 * timber[0].count + crowns[0].geometry.index.count / 3 * crowns[0].count;
  assert.ok(triangles < 8000); scene.dispose();
});
test('Cleanup releases owned instances/geometries/tint clones, never borrowed maps or materials', () => {
  const scene = buildGameEnvironments(), parent = new Group(); parent.add(scene.root);
  let borrowedDisposed = 0, textureDisposed = 0, imageClosed = 0;
  for (const id of Object.keys(sources)) {
    const { source, materials, texture } = fixture(id); texture.image = { close() { imageClosed++; } };
    texture.addEventListener('dispose', () => textureDisposed++);
    for (const material of materials.values()) material.addEventListener('dispose', () => borrowedDisposed++);
    scene.applyWorldMaterials(id, source);
  }
  const geometries = new Set(), clones = new Set(), instances = [];
  scene.root.traverse(node => { if (node.isMesh) { geometries.add(node.geometry); if (node instanceof InstancedMesh) instances.push(node); } });
  for (const id of Object.keys(sources)) { scene.setWorld(id); clones.add(scene.root.getObjectByName('Soft distant sage hills').material); }
  let geometryDisposed = 0, cloneDisposed = 0, instanceDisposed = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => geometryDisposed++)); clones.forEach(material => material.addEventListener('dispose', () => cloneDisposed++));
  instances.forEach(instance => instance.addEventListener('dispose', () => instanceDisposed++)); scene.dispose(); scene.dispose();
  assert.equal(geometryDisposed, geometries.size); assert.equal(cloneDisposed, clones.size); assert.equal(instanceDisposed, instances.length);
  assert.equal(borrowedDisposed, 0); assert.equal(textureDisposed, 0); assert.equal(imageClosed, 0);
  assert.equal(scene.root.children.length, 0); assert.equal(scene.root.parent, null); assert.equal(parent.children.length, 0);
});
