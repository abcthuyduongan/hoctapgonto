import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, Vector3, SRGBColorSpace, NoColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetLoader } from '../src/world3d/renderer/assetLoader.ts';
import { disposeScene } from '../src/world3d/renderer/disposeScene.ts';

// Node has no browser image decoder. Decode the actual embedded PNG pixels for
// GLTFLoader's ImageBitmapLoader; browser/WebGL upload remains a separate QA gate.
function decodePng(bytes) {
  const buffer = Buffer.from(bytes);
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let width, height, channels;
  const parts = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + 12 + length <= buffer.length, 'PNG chunk must fit its image');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'authored textures use 8-bit samples');
      assert.ok(data[9] === 2 || data[9] === 6, 'authored textures use RGB or RGBA');
      channels = data[9] === 6 ? 4 : 3;
      assert.equal(data[10], 0); assert.equal(data[11], 0); assert.equal(data[12], 0);
    } else if (type === 'IDAT') parts.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  assert.ok(width >= 16 && height >= 16 && width <= 2048 && height <= 2048);
  const raw = inflateSync(Buffer.concat(parts)), stride = width * channels;
  assert.equal(raw.length, (stride + 1) * height);
  const decoded = new Uint8Array(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= channels ? decoded[i - channels] : 0;
      const b = y ? decoded[i - stride] : 0, c = y && x >= channels ? decoded[i - stride - channels] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      decoded[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, data: decoded, close() {} };
}
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
Object.defineProperty(globalThis, 'createImageBitmap', {
  configurable: true, value: async blob => decodePng(await blob.arrayBuffer()),
});
after(() => {
  if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf); else delete globalThis.self;
  if (originalBitmap) Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap); else delete globalThis.createImageBitmap;
});

const fixtures = new Map();
async function fixture(name) {
  if (!fixtures.has(name)) {
    fixtures.set(name, (async () => {
      const bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
      assert.equal(bytes.readUInt32LE(0), 0x46546c67);
      assert.equal(bytes.readUInt32LE(4), 2);
      assert.equal(bytes.readUInt32LE(8), bytes.length);
      const jsonLength = bytes.readUInt32LE(12);
      assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
      const binHeader = 20 + jsonLength;
      assert.equal(bytes.readUInt32LE(binHeader + 4), 0x004e4942);
      const binary = bytes.subarray(binHeader + 8);
      assert.equal(bytes.readUInt32LE(binHeader), binary.length);
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return { json, binary, byteLength: bytes.length, gltf: await new GLTFLoader().parseAsync(arrayBuffer, '') };
    })());
  }
  return fixtures.get(name);
}
function meshes(scene) {
  const result = [];
  scene.traverse(node => { if (node.isMesh) result.push(node); });
  return result;
}
function materials(scene) {
  return new Set(meshes(scene).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
}
function deformedVertices(scene) {
  scene.updateMatrixWorld(true);
  const result = [];
  for (const mesh of meshes(scene).filter(item => item.isSkinnedMesh)) {
    mesh.skeleton.update();
    const position = mesh.geometry.getAttribute('position');
    const step = Math.max(1, Math.floor(position.count / 100));
    for (let i = 0; i < position.count; i += step) {
      result.push(mesh.applyBoneTransform(i, new Vector3().fromBufferAttribute(position, i)));
    }
  }
  return result;
}

const pr03Assets = new Set(['memory-world', 'language-world', 'environment']);
for (const name of ['fox-guide', 'math-world', ...pr03Assets]) {
  test(`${name}: self-contained candidate asset loads real 3D geometry and embedded PBR textures`, async () => {
    const { json, binary, byteLength, gltf } = await fixture(name);
    assert.equal(json.asset.version, '2.0');
    assert.ok(binary.length > 0 && binary.length < 16 * 1024 * 1024);
    assert.ok(json.buffers.every(buffer => !buffer.uri));
    assert.ok(json.images.length >= 3 && json.images.every(image => image.bufferView !== undefined && !image.uri));
    assert.equal(json.asset.extras.provenance, pr03Assets.has(name) ? 'ORIGINAL_PROCEDURAL_V37_PR03' : 'ORIGINAL_PROCEDURAL_V37_PR02');
    assert.equal(json.asset.extras.acceptance, 'candidate-not-art-approved');
    const loaded = meshes(gltf.scene);
    assert.ok(loaded.length > 0);
    let triangleCount = 0;
    for (const mesh of loaded) {
      const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
      const uv = mesh.geometry.getAttribute('uv');
      assert.ok(position && normal && uv, `${mesh.name} has positions, normals, and UVs`);
      assert.equal(normal.count, position.count);
      assert.equal(uv.count, position.count);
      assert.ok([...position.array, ...normal.array, ...uv.array].every(Number.isFinite));
      assert.ok([...normal.array].some(value => Math.abs(value) > .1));
      assert.ok([...uv.array].some(value => value !== uv.array[0]), 'UVs cover more than one texel');
      if (mesh.geometry.index) assert.ok([...mesh.geometry.index.array].every(index => Number.isInteger(index) && index >= 0 && index < position.count), `${mesh.name}: decoded indices reference valid vertices`);
      assert.equal((mesh.geometry.index?.count ?? position.count) % 3, 0, 'triangle lists contain complete triangles');
      triangleCount += (mesh.geometry.index?.count ?? position.count) / 3;
    }
    assert.ok(triangleCount >= 500, `modeled volume has ${triangleCount} triangles`);
    if (pr03Assets.has(name)) {
      assert.ok(byteLength <= 2 * 1024 * 1024, `${name} must fit the 2 MiB authored-asset budget; received ${byteLength} bytes`);
      assert.ok(triangleCount <= (name === 'environment' ? 20_000 : 35_000), `${name} contains ${triangleCount} triangles within its scene budget`);
    }
    const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
    assert.ok(size.x > .1 && size.y > .1 && size.z > .1, 'geometry has volume in all three axes');
    const loadedMaterials = [...materials(gltf.scene)];
    assert.ok(loadedMaterials.some(material => material.map && material.normalMap && material.roughnessMap));
    if (pr03Assets.has(name)) assert.ok(loadedMaterials.every(material => material.map && material.normalMap && material.roughnessMap && material.metalnessMap), `${name}: every authored material has loaded base color, normal and ORM maps`);
    for (const material of loadedMaterials) {
      assert.ok(material.isMeshStandardMaterial, 'glTF PBR material survives runtime import');
      const materialIndex = gltf.parser.associations.get(material)?.materials;
      assert.ok(materialIndex !== undefined, 'runtime material retains its glTF association');
      const definition = json.materials[materialIndex];
      const expected = {
        map: definition.pbrMetallicRoughness?.baseColorTexture,
        normalMap: definition.normalTexture,
        roughnessMap: definition.pbrMetallicRoughness?.metallicRoughnessTexture,
        metalnessMap: definition.pbrMetallicRoughness?.metallicRoughnessTexture,
      };
      for (const channel of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
        if (!expected[channel]) continue;
        assert.ok(material[channel]?.isTexture, `${material.name}: ${channel} is loaded`);
        assert.ok(material[channel].image.data.length > 0, `${material.name}: ${channel} decodes pixels`);
      }
      if (!material.map) continue;
      assert.equal(material.map.colorSpace, SRGBColorSpace);
      if (material.normalMap) assert.equal(material.normalMap.colorSpace, NoColorSpace);
      if (material.roughnessMap) assert.equal(material.roughnessMap.colorSpace, NoColorSpace);
      const pixels = material.map.image.data;
      assert.ok(new Set(pixels).size > 4, `${name}/${material.name}: base-color map contains actual surface variation (received ${new Set(pixels).size} distinct channel values)`);
    }
  });
}

test('PR03 additions preserve the existing Fox and Math GLB bytes', () => {
  const expected = {
    'fox-guide': '398382e919be69af9502cb103e3d1359147157e76ac852a30ad07cd60a23e9fc',
    'math-world': 'dd7cacdfb62d86b0dc287b264d6cc71df5822a2b6943c48d73c5c84b3091d6cb',
  };
  for (const [name, hash] of Object.entries(expected)) {
    const bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `${name} remains the existing PR02 asset`);
  }
});

test('fox: runtime skin has nontrivial bones, valid normalized weights, and bone clip channels', async () => {
  const { json, gltf } = await fixture('fox-guide');
  assert.ok(json.skins?.length > 0);
  const joints = new Set(json.skins.flatMap(skin => skin.joints));
  assert.ok(joints.size >= 10);
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), ['Cheer', 'Idle', 'Victory']);
  for (const clip of json.animations) {
    assert.ok(clip.channels.length >= 3, `${clip.name} changes multiple bones`);
    assert.ok(clip.channels.every(channel => joints.has(channel.target.node)), `${clip.name} targets skeleton joints`);
    assert.ok(clip.channels.some(channel => !/^Root$/i.test(json.nodes[channel.target.node].name)), `${clip.name} moves more than the whole fox`);
  }
  const skinned = meshes(gltf.scene).filter(mesh => mesh.isSkinnedMesh);
  assert.ok(skinned.length > 0);
  for (const mesh of skinned) {
    assert.ok(mesh.skeleton.bones.length >= 10);
    assert.ok(mesh.skeleton.bones.every(bone => bone.isBone));
    const weights = mesh.geometry.getAttribute('skinWeight'), indices = mesh.geometry.getAttribute('skinIndex');
    assert.equal(weights.count, mesh.geometry.getAttribute('position').count);
    assert.equal(indices.count, weights.count);
    for (let i = 0; i < weights.count; i++) {
      const w = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      const j = [indices.getX(i), indices.getY(i), indices.getZ(i), indices.getW(i)];
      assert.ok(w.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      assert.ok(Math.abs(w.reduce((sum, value) => sum + value, 0) - 1) < 1e-4);
      assert.ok(j.every(value => Number.isInteger(value) && value >= 0 && value < mesh.skeleton.bones.length));
    }
  }
});

test('fox: AnimationMixer plays Idle, Cheer, and Victory and deforms skinned vertices', async () => {
  const { gltf } = await fixture('fox-guide');
  const mixer = new AnimationMixer(gltf.scene), rootTransform = gltf.scene.matrix.clone();
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).reset().play();
    mixer.update(0);
    const initial = deformedVertices(gltf.scene);
    let changed = false;
    for (let i = 0; i < 12; i++) {
      mixer.update(clip.duration / 16);
      const current = deformedVertices(gltf.scene);
      changed ||= current.some((position, index) => position.distanceTo(initial[index]) > 1e-3);
    }
    assert.ok(action.isRunning(), `${clip.name} is an active runtime action`);
    assert.ok(changed, `${clip.name} must deform skin rather than translate the whole model`);
    assert.ok(gltf.scene.matrix.equals(rootTransform));
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
});

test('premium manifest retains all five mandatory assets and fox texture/clip requirements', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/world3d/assets/premium-manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.assets.map(asset => asset.id).sort(), ['environment', 'fox-guide', 'language-world', 'math-world', 'memory-world']);
  assert.ok(manifest.assets.every(asset => asset.mustHaveTextures));
  const fox = manifest.assets.find(asset => asset.id === 'fox-guide');
  assert.equal(fox.mustHaveAnimation, true);
  assert.ok(fox.minAnimations >= 3);
});

function instrumentAssetLoad(t, controller, { failImage = 0, afterParse } = {}) {
  const nativeFetch = globalThis.fetch, parse = GLTFLoader.prototype.parseAsync;
  const bitmapDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ImageBitmap');
  const bytes = readFileSync(new URL('../public/models/fox-guide.glb', import.meta.url));
  const images = [], disposed = new Map();
  let decoded, imageCount = 0;
  class NodeImageBitmap {
    constructor(image) {
      this.width = image.width; this.height = image.height; this.data = image.data;
      this.closed = 0; images.push(this);
    }
    close() { this.closed++; }
  }
  Object.defineProperty(globalThis, 'ImageBitmap', { configurable: true, value: NodeImageBitmap });
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true, value: async blob => {
      if (++imageCount === failImage) throw new Error('QA embedded image decode failure');
      return new NodeImageBitmap(decodePng(await blob.arrayBuffer()));
    },
  });
  t.after(() => {
    Object.defineProperty(globalThis, 'createImageBitmap', bitmapDescriptor);
    if (imageDescriptor) Object.defineProperty(globalThis, 'ImageBitmap', imageDescriptor); else delete globalThis.ImageBitmap;
  });
  t.mock.method(globalThis, 'fetch', async (path, opts) => {
    if (path === '/models/fox-guide.glb') {
      assert.equal(opts.signal, controller.signal);
      return new Response(bytes, { status: 200 });
    }
    return nativeFetch(path, opts);
  });
  t.mock.method(GLTFLoader.prototype, 'parseAsync', async function (...args) {
    decoded = await parse.apply(this, args);
    const resources = new Set(), skeletons = new Set();
    decoded.scene.traverse(node => {
      if (!node.isMesh) return;
      resources.add(node.geometry);
      if (node.skeleton) skeletons.add(node.skeleton);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        resources.add(material);
        Object.values(material).filter(value => value?.isTexture).forEach(value => resources.add(value));
      }
    });
    for (const resource of resources) {
      disposed.set(resource, 0);
      resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
    }
    for (const skeleton of skeletons) {
      const dispose = skeleton.dispose;
      disposed.set(skeleton, 0);
      t.mock.method(skeleton, 'dispose', function (...args) {
        disposed.set(skeleton, disposed.get(skeleton) + 1);
        return dispose.apply(this, args);
      });
    }
    afterParse?.(decoded);
    return decoded;
  });
  return {
    images, disposed, get decoded() { return decoded; },
    assertDisposed() {
      assert.ok(decoded, 'real GLTFLoader finished parsing before cleanup');
      assert.equal(decoded.scene.children.length, 0);
      assert.ok(disposed.size > 0);
      assert.ok([...disposed.values()].every(count => count === 1), 'each decoded GPU resource disposed exactly once');
      assert.ok(images.length > 0);
      assert.ok(images.every(image => image.closed === 1), 'every successfully decoded bitmap is closed once');
    },
  };
}

test('AssetLoader rejects a missing declared PBR map and disposes other successfully decoded resources', async t => {
  t.mock.method(console, 'error', () => {});
  const controller = new AbortController(), probe = instrumentAssetLoad(t, controller, { failImage: 1 });
  const loader = new AssetLoader(controller.signal);
  await assert.rejects(loader.load('/models/fox-guide.glb'), /texture PBR không giải mã được/);
  probe.assertDisposed();
});

test('AssetLoader abort after actual GLTF decoding disposes skins, textures, and bitmaps before rejecting', async t => {
  const controller = new AbortController(), reason = new Error('unmounted just after decoding');
  const probe = instrumentAssetLoad(t, controller, { afterParse: () => controller.abort(reason) });
  const loader = new AssetLoader(controller.signal);
  await assert.rejects(loader.load('/models/fox-guide.glb'), error => error === reason);
  probe.assertDisposed();
});

test('AssetLoader accepts correctly decoded PBR maps and shares one pending parse per asset path', async t => {
  const controller = new AbortController(), probe = instrumentAssetLoad(t, controller);
  const loader = new AssetLoader(controller.signal);
  const pending = loader.load('/models/fox-guide.glb');
  assert.equal(loader.load('/models/fox-guide.glb'), pending);
  const result = await pending;
  assert.equal(result, probe.decoded);
  assert.ok([...materials(result.scene)].every(material => material.map && material.normalMap && material.roughnessMap && material.metalnessMap));
  assert.ok(probe.images.every(image => image.closed === 0), 'successful textures stay available until owner disposal');
  disposeScene(result.scene);
  probe.assertDisposed();
});
