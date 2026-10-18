/** Derive small, immutable public assets; authored masters and the fox rig stay intact. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { png } from './generate_v37_slice_assets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const names = ['fox-guide', 'environment', 'math-world', 'memory-world', 'language-world'];
const dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const widths = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function resizePng(bytes, maxSize = 128) {
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0) throw new Error('Expected authored non-interlaced PNG');
      channels = data[9] === 6 ? 4 : 3;
    }
    if (kind === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  if (!width || !height || width > 2048 || height > 2048) throw new Error('Invalid authored texture dimensions');
  if (Math.max(width, height) <= maxSize) return bytes;
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, a = x >= channels ? pixels[at - channels] : 0, b = y ? pixels[at - stride] : 0, c = y && x >= channels ? pixels[at - stride - channels] : 0;
      pixels[at] = (raw[y * (stride + 1) + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  const scale = maxSize / Math.max(width, height), w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  return png(w, h, (x, y) => {
    const sum = [0, 0, 0, 0]; let count = 0;
    for (let py = Math.floor(y * height / h); py < Math.floor((y + 1) * height / h); py++) for (let px = Math.floor(x * width / w); px < Math.floor((x + 1) * width / w); px++) {
      const at = (py * width + px) * channels;
      for (let c = 0; c < 4; c++) sum[c] += c === 3 && channels === 3 ? 255 : pixels[at + c];
      count++;
    }
    return sum.map(value => value / count);
  });
}

export async function optimizeGlb(bytes, { simplify = true } = {}) {
  const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength), views = gltf.bufferViews.map(view => Buffer.from(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)));
  const accessorArray = index => {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    if (view.byteStride || a.sparse) throw new Error('Unexpected authored strided/sparse accessor');
    const data = views[a.bufferView].subarray(a.byteOffset ?? 0), count = a.count * dimensions[a.type];
    return Array.from({ length: count }, (_, i) => a.componentType === 5126 ? data.readFloatLE(i * 4) : a.componentType === 5125 ? data.readUInt32LE(i * 4) : data.readUInt16LE(i * 2));
  };
  const setAccessor = (index, values, componentType) => {
    const a = gltf.accessors[index], width = widths[componentType], data = Buffer.alloc(values.length * width);
    values.forEach((v, i) => componentType === 5126 ? data.writeFloatLE(v, i * width) : componentType === 5125 ? data.writeUInt32LE(v, i * width) : componentType === 5121 ? data.writeUInt8(v, i) : data.writeUInt16LE(v, i * width));
    views[a.bufferView] = data; a.componentType = componentType; a.byteOffset = 0; a.count = values.length / dimensions[a.type];
    if (a.min) {
      a.min = Array(dimensions[a.type]).fill(Infinity); a.max = a.min.map(() => -Infinity);
      values.forEach((v, i) => { const c = i % a.min.length; a.min[c] = Math.min(a.min[c], v); a.max[c] = Math.max(a.max[c], v); });
    }
  };
  await MeshoptSimplifier.ready;
  let originalTriangles = 0, optimizedTriangles = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const indices = new Uint32Array(accessorArray(primitive.indices)); originalTriangles += indices.length / 3;
    // Bone weights, bind matrices, animation channels and skinned geometry are never simplified.
    if (simplify && !('JOINTS_0' in primitive.attributes) && indices.length >= 240) {
      const positions = new Float32Array(accessorArray(primitive.attributes.POSITION)), normals = accessorArray(primitive.attributes.NORMAL), uv = accessorArray(primitive.attributes.TEXCOORD_0);
      const attributes = new Float32Array(positions.length / 3 * 5);
      for (let i = 0; i < positions.length / 3; i++) attributes.set([...normals.slice(i * 3, i * 3 + 3), ...uv.slice(i * 2, i * 2 + 2)], i * 5);
      const target = Math.max(3, Math.floor(indices.length * .30 / 3) * 3);
      const [result] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attributes, 5, [.1, .1, .1, .1, .1], null, target, .02, ['LockBorder']);
      const [remap, count] = MeshoptSimplifier.compactMesh(result);
      for (const index of Object.values(primitive.attributes)) {
        const a = gltf.accessors[index], source = accessorArray(index), size = dimensions[a.type], packed = Array(count * size).fill(0);
        for (let vertex = 0; vertex < remap.length; vertex++) if (remap[vertex] !== 0xffffffff) for (let c = 0; c < size; c++) packed[remap[vertex] * size + c] = source[vertex * size + c];
        setAccessor(index, packed, a.componentType);
      }
      setAccessor(primitive.indices, Array.from(result), count <= 65535 ? 5123 : 5125);
      optimizedTriangles += result.length / 3;
    } else optimizedTriangles += indices.length / 3;
  }
  // Core glTF supports normalized ushort UV/weights and byte joint indices.
  // No runtime decoder or quantization extension is needed; positions/normals,
  // bone hierarchy, bind matrices and animation samples remain untouched.
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const uvIndex = primitive.attributes.TEXCOORD_0, uv = accessorArray(uvIndex);
    if (uv.every(value => value >= 0 && value <= 1)) {
      setAccessor(uvIndex, uv.map(value => Math.round(value * 65535)), 5123); gltf.accessors[uvIndex].normalized = true;
    }
    if ('JOINTS_0' in primitive.attributes) {
      const jointIndex = primitive.attributes.JOINTS_0, joints = accessorArray(jointIndex);
      if (joints.every(value => value < 256)) setAccessor(jointIndex, joints, 5121);
      const weightIndex = primitive.attributes.WEIGHTS_0, source = accessorArray(weightIndex), weights = source.map(value => Math.round(value * 65535));
      for (let i = 0; i < weights.length; i += 4) {
        const largest = source.slice(i, i + 4).indexOf(Math.max(...source.slice(i, i + 4)));
        weights[i + largest] += 65535 - weights.slice(i, i + 4).reduce((sum, value) => sum + value, 0);
      }
      setAccessor(weightIndex, weights, 5123); gltf.accessors[weightIndex].normalized = true;
    }
  }
  for (const image of gltf.images) {
    if (image.mimeType !== 'image/png' || image.uri) throw new Error('Expected embedded PNG textures');
    views[image.bufferView] = resizePng(views[image.bufferView]);
    image.name = `${image.name ?? 'texture'}_low128`;
  }
  let offset = 0;
  const packed = views.map((data, index) => {
    gltf.bufferViews[index].byteOffset = offset; gltf.bufferViews[index].byteLength = data.length;
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4); data.copy(padded); offset += padded.length; return padded;
  });
  gltf.buffers[0].byteLength = offset;
  gltf.asset.extras = { ...gltf.asset.extras, optimization: { textureMaxSize: 128, staticRatio: .30, relativeError: .02, rigPreserved: true, coreNormalizedUvAndWeights: true } };
  const json = Buffer.from(JSON.stringify(gltf)), jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(jsonPadded);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPadded.length + offset, 8); header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(offset); binHeader.writeUInt32LE(0x004e4942, 4);
  return { bytes: Buffer.concat([header, jsonPadded, binHeader, ...packed]), originalTriangles, optimizedTriangles };
}

export async function generateOptimizedModels() {
  const out = path.join(ROOT, 'public/models/optimized'); await fs.mkdir(out, { recursive: true });
  const assets = {};
  for (const name of names) {
    const master = await fs.readFile(path.join(ROOT, 'public/models', `${name}.glb`));
    const result = await optimizeGlb(master), digest = hash(result.bytes), filename = `${name}-${digest.slice(0, 16)}.glb`;
    await fs.writeFile(path.join(out, filename), result.bytes);
    assets[name] = { url: `/models/optimized/${filename}`, bytes: result.bytes.length, sha256: digest, sourceSha256: hash(master), sourceBytes: master.length, originalTriangles: result.originalTriangles, optimizedTriangles: result.optimizedTriangles };
  }
  const manifest = { version: 1, assets };
  for (const id of ['math-world', 'memory-world', 'language-world']) if (assets['fox-guide'].bytes + assets.environment.bytes + assets[id].bytes > 2 * 1024 * 1024) throw new Error(`${id}: active low scene exceeds 2 MiB transfer budget`);
  await fs.writeFile(path.join(ROOT, 'src/world3d/assets/optimized-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest=await generateOptimizedModels();
  if(!process.argv.includes('--quiet'))console.log(JSON.stringify(manifest,null,2));
}
