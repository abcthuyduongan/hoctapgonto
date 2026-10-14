/**
 * Original V3.7 / PR02 candidate models. No external geometry, image, font or rig.
 * Reproduce: node tools/generate_v37_slice_assets.mjs
 * Node built-ins only. This is a reviewable authored candidate, not art approval.
 * Coordinate convention: metres, Y up, fox looks +Z; island ground surface Y=0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(ROOT, 'public', 'models');
const TAU = Math.PI * 2;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, n) => a.map(v => v * n);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / (Math.hypot(...a) || 1));
const lerp = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Hex swatches are sRGB; glTF baseColorFactor stores linear-light channels.
const color = hex => hex.match(/\w\w/g).map(v => {
  const c = parseInt(v, 16) / 255;
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
});
const rotZ = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
const quat = (axis, angle) => [...mul(norm(axis), Math.sin(angle / 2)), Math.cos(angle / 2)];

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(name, data) {
  const tag = Buffer.from(name), out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0); tag.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([tag, data])), data.length + 8);
  return out;
}
function png(width, height, pixel) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const line = y * (width * 4 + 1); raw[line] = 0;
    for (let x = 0; x < width; x++) {
      const rgba = pixel(x, y);
      for (let c = 0; c < 4; c++) raw[line + x * 4 + c + 1] = clamp(Math.round(rgba[c]), 0, 255);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

// Periodic height patterns generate useful colour variation, normal and roughness.
// Maps describe fur strands, woven cloth, weathered stone, grass and wood grain.
function textureSet(kind, size = 256) {
  const height = (x, y) => {
    const u = x / size * TAU, v = y / size * TAU;
    const grain = Math.sin(u * 29 + Math.sin(v * 13)) * Math.cos(v * 31 + u * 3) * .045;
    if (kind === 'fur') return .50 + Math.sin(u * 38 + Math.sin(v * 3) * 2) * .095 + Math.sin(v * 8) * .035 + grain;
    if (kind === 'fabric') return .52 + Math.sin(u * 32) * Math.sin(v * 32) * .13 + grain * .4;
    if (kind === 'stone') {
      const row = Math.floor(y / 32), seam = y % 32 < 2 || (x + (row % 2) * 32) % 64 < 2;
      return seam ? .24 : .56 + Math.sin(u * 4) * Math.cos(v * 8) * .075 + grain;
    }
    if (kind === 'rock') {
      // Uncut sandstone uses sediment/grain rather than the castle's masonry seams.
      const sediment = Math.sin(v * 7 + Math.sin(u * 3) * .7) * .050;
      const chips = Math.sin(u * 17 + Math.cos(v * 11)) * Math.cos(v * 19 - u * 4) * .028;
      return .53 + sediment + chips + grain * .7;
    }
    if (kind === 'grass') return .55 + Math.sin(u * 37 + Math.cos(v * 7)) * .065 + Math.cos(v * 31) * .05 + grain;
    if (kind === 'wood') return .53 + Math.sin(u * 9 + Math.sin(v * 2) * 1.7) * .15 + grain;
    return .55 + Math.sin(u * 4) * Math.cos(v * 4) * .018 + grain * .2;
  };
  return {
    base: png(size, size, (x, y) => { const n = 214 + height(x, y) * 55; return [n, n, n, 255]; }),
    normal: png(size, size, (x, y) => {
      const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y);
      const dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
      const n = norm([-dx * 1.2, -dy * 1.2, 1]); return [...n.map(v => (v * .5 + .5) * 255), 255];
    }),
    rough: png(size, size, (x, y) => [255, 178 + height(x, y) * 49, 0, 255]),
  };
}

class Model {
  constructor(name) {
    this.name = name; this.groups = new Map(); this.binary = [];
    this.gltf = {
      asset: { version: '2.0', generator: 'Bao An original candidate asset generator V3.7 PR02', extras: { provenance: 'ORIGINAL_PROCEDURAL_V37_PR02', source: 'tools/generate_v37_slice_assets.mjs', acceptance: 'candidate-not-art-approved', externalAssets: [] } },
      scene: 0, scenes: [{ name, nodes: [] }], nodes: [], meshes: [], materials: [], textures: [], images: [],
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [],
    };
    this.maps = new Map(); this.bones = [];
  }
  bytes(buf, target) {
    const len = this.binary.reduce((n, b) => n + b.length, 0);
    const padded = Buffer.alloc(Math.ceil(buf.length / 4) * 4); buf.copy(padded); this.binary.push(padded);
    const view = { buffer: 0, byteOffset: len, byteLength: buf.length }; if (target) view.target = target;
    this.gltf.bufferViews.push(view); return this.gltf.bufferViews.length - 1;
  }
  accessor(values, type, componentType = 5126, target = 34962, minmax = false) {
    const itemSize = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const width = componentType === 5126 || componentType === 5125 ? 4 : 2;
    const buf = Buffer.alloc(values.length * width);
    values.forEach((v, i) => componentType === 5126 ? buf.writeFloatLE(v, i * width) : componentType === 5125 ? buf.writeUInt32LE(v, i * width) : buf.writeUInt16LE(v, i * width));
    const a = { bufferView: this.bytes(buf, target), byteOffset: 0, componentType, count: values.length / itemSize, type };
    if (minmax) {
      a.min = Array(itemSize).fill(Infinity); a.max = Array(itemSize).fill(-Infinity);
      values.forEach((v, i) => { const c = i % itemSize; a.min[c] = Math.min(a.min[c], v); a.max[c] = Math.max(a.max[c], v); });
    }
    this.gltf.accessors.push(a); return this.gltf.accessors.length - 1;
  }
  texture(kind) {
    if (this.maps.has(kind)) return this.maps.get(kind);
    const maps = textureSet(kind), ids = {};
    for (const [role, data] of Object.entries(maps)) {
      const view = this.bytes(data); const image = this.gltf.images.length;
      this.gltf.images.push({ name: `${kind}_${role}_256`, mimeType: 'image/png', bufferView: view });
      ids[role] = this.gltf.textures.length; this.gltf.textures.push({ name: `${kind}_${role}`, source: image, sampler: 0 });
    }
    this.maps.set(kind, ids); return ids;
  }
  material(name, hex, kind = 'satin', rough = .8) {
    const tex = this.texture(kind); const id = this.gltf.materials.length;
    this.gltf.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [...color(hex), 1], baseColorTexture: { index: tex.base }, roughnessFactor: rough, metallicFactor: 0, metallicRoughnessTexture: { index: tex.rough } }, normalTexture: { index: tex.normal, scale: .65 } });
    return id;
  }
  bone(name, parent, position) {
    const id = this.bones.length; this.bones.push({ name, parent, position }); return id;
  }
  mesh(material, name) {
    if (!this.groups.has(material)) this.groups.set(material, { name, p: [], n: [], uv: [], j: [], w: [], idx: [] });
    return this.groups.get(material);
  }
  vertex(mesh, p, n, uv, weights = [[0, 1]]) {
    mesh.p.push(...p); mesh.n.push(...norm(n)); mesh.uv.push(...uv);
    const normalized = weights.map(([id, weight]) => [id, weight / weights.reduce((s, w) => s + w[1], 0)]);
    while (normalized.length < 4) normalized.push([0, 0]);
    mesh.j.push(...normalized.slice(0, 4).map(w => w[0])); mesh.w.push(...normalized.slice(0, 4).map(w => w[1]));
    return mesh.p.length / 3 - 1;
  }
  sphere(c, r, mat, bone = 0, name = 'Rounded surfaces', rings = 16, sides = 24, tilt = 0, weightFn) {
    const mesh = this.mesh(mat, name), base = mesh.p.length / 3;
    for (let y = 0; y <= rings; y++) for (let x = 0; x <= sides; x++) {
      const ph = y / rings * Math.PI, th = x / sides * TAU;
      const p = [Math.sin(ph) * Math.cos(th) * r[0], Math.cos(ph) * r[1], Math.sin(ph) * Math.sin(th) * r[2]];
      const n = [p[0] / r[0] ** 2, p[1] / r[1] ** 2, p[2] / r[2] ** 2];
      const pt = add(c, rotZ(p, tilt)); this.vertex(mesh, pt, rotZ(n, tilt), [x / sides, y / rings], weightFn ? weightFn(pt) : [[bone, 1]]);
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < sides; x++) {
      const a = base + y * (sides + 1) + x, b = a + sides + 1, c2 = b + 1, d = a + 1;
      if (y > 0) mesh.idx.push(a, d, c2); if (y < rings - 1) mesh.idx.push(a, c2, b);
    }
  }
  tube(points, radii, mat, bone = 0, name = 'Curved trim', sides = 12, weightsFn) {
    const mesh = this.mesh(mat, name), base = mesh.p.length / 3;
    const tangents = points.map((p, i) => norm(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)])));
    for (let i = 0; i < points.length; i++) {
      const t = tangents[i], u = norm(cross(Math.abs(t[1]) < .9 ? [0, 1, 0] : [0, 0, 1], t)), v = cross(t, u);
      const previous = Math.max(i - 1, 0), next = Math.min(i + 1, points.length - 1);
      const slope = Array.isArray(radii) ? (radii[next] - radii[previous]) / (Math.hypot(...sub(points[next], points[previous])) || 1) : 0;
      for (let s = 0; s <= sides; s++) {
        const a = s / sides * TAU, n = add(mul(u, Math.cos(a)), mul(v, Math.sin(a))), radius = Array.isArray(radii) ? radii[i] : radii;
        this.vertex(mesh, add(points[i], mul(n, radius)), sub(n, mul(t, slope)), [s / sides, i / (points.length - 1)], weightsFn ? weightsFn(i / (points.length - 1)) : [[bone, 1]]);
      }
    }
    for (let i = 0; i < points.length - 1; i++) for (let s = 0; s < sides; s++) {
      const a = base + i * (sides + 1) + s, b = a + sides + 1;
      mesh.idx.push(a, a + 1, b + 1, a, b + 1, b);
    }
    for (const end of [0, points.length - 1]) {
      const capNormal = mul(tangents[end], end === 0 ? -1 : 1), capWeights = weightsFn ? weightsFn(end / (points.length - 1)) : [[bone, 1]];
      const center = this.vertex(mesh, points[end], capNormal, [.5, .5], capWeights), capBase = mesh.p.length / 3;
      for (let s = 0; s <= sides; s++) {
        const idx = (base + end * (sides + 1) + s) * 3;
        this.vertex(mesh, mesh.p.slice(idx, idx + 3), capNormal, [.5 + Math.cos(s / sides * TAU) * .5, .5 + Math.sin(s / sides * TAU) * .5], capWeights);
      }
      for (let s = 0; s < sides; s++) {
        const a = capBase + s;
        mesh.idx.push(center, ...(end === 0 ? [a + 1, a] : [a, a + 1]));
      }
    }
  }
  box(c, size, bevel, mat, bone = 0, name = 'Hand shaped bevel masonry', grid = 6) {
    const mesh = this.mesh(mat, name), half = mul(size, .5), inner = half.map(v => Math.max(0, v - bevel));
    const faces = [[0, 1, 2, 1], [0, 2, 1, -1], [1, 2, 0, 1], [1, 0, 2, -1], [2, 0, 1, 1], [2, 1, 0, -1]];
    for (const [axis, a, b, sign] of faces) {
      const base = mesh.p.length / 3;
      for (let v = 0; v <= grid; v++) for (let u = 0; u <= grid; u++) {
        const p = [0, 0, 0]; p[axis] = half[axis] * sign; p[a] = (u / grid * 2 - 1) * half[a]; p[b] = (v / grid * 2 - 1) * half[b];
        const q = p.map((val, idx) => clamp(val, -inner[idx], inner[idx])), n = norm(sub(p, q));
        this.vertex(mesh, add(c, add(q, mul(n, bevel))), n, [u / grid, v / grid], [[bone, 1]]);
      }
      for (let v = 0; v < grid; v++) for (let u = 0; u < grid; u++) {
        const a0 = base + v * (grid + 1) + u, b0 = a0 + 1, c0 = b0 + grid + 1, d0 = a0 + grid + 1;
        mesh.idx.push(a0, b0, c0, a0, c0, d0);
      }
    }
  }
  tapered(c, height, bottom, top, mat, name, sides = 32) {
    const points = [[c[0], c[1] - height / 2, c[2]], [c[0], c[1] + height / 2, c[2]]];
    this.tube(points, [bottom, top], mat, 0, name, sides);
  }
  arch(cx, bottom, z, width, height, depth, mat) {
    const mesh = this.mesh(mat, 'Arched doors and recessed windows'), outline = [[-width / 2, 0], [width / 2, 0], [width / 2, height - width / 2]];
    for (let i = 1; i <= 16; i++) { const a = i / 16 * Math.PI; outline.push([Math.cos(a) * width / 2, height - width / 2 + Math.sin(a) * width / 2]); }
    const center = [0, height * .45];
    for (const front of [-1, 1]) {
      const base = mesh.p.length / 3, pz = z + front * depth / 2;
      this.vertex(mesh, [cx, bottom + center[1], pz], [0, 0, front], [.5, .5]);
      outline.forEach(p => this.vertex(mesh, [cx + p[0], bottom + p[1], pz], [0, 0, front], [p[0] / width + .5, p[1] / height]));
      for (let i = 0; i < outline.length; i++) {
        const a = base + i + 1, b = base + (i + 1) % outline.length + 1;
        mesh.idx.push(base, ...(front === 1 ? [a, b] : [b, a]));
      }
    }
    // Close extruded edges, retaining the actual 3D silhouette.
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length], n = norm([b[1] - a[1], a[0] - b[0], 0]), base = mesh.p.length / 3;
      for (const [p, dz] of [[a, -1], [b, -1], [b, 1], [a, 1]]) this.vertex(mesh, [cx + p[0], bottom + p[1], z + dz * depth / 2], n, [p[0] / width + .5, p[1] / height]);
      mesh.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  finish(animations = []) {
    if (this.bones.length) {
      this.bones.forEach(b => this.gltf.nodes.push({ name: b.name, translation: sub(b.position, b.parent < 0 ? [0, 0, 0] : this.bones[b.parent].position), extras: { role: 'deforming-bone' } }));
      this.bones.forEach((b, i) => { if (b.parent >= 0) (this.gltf.nodes[b.parent].children ??= []).push(i); });
      this.gltf.scenes[0].nodes.push(0);
      const bind = this.bones.flatMap(b => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...mul(b.position, -1), 1]);
      this.gltf.skins = [{ name: 'BaoAnFox_DeformingRig', skeleton: 0, joints: this.bones.map((_, i) => i), inverseBindMatrices: this.accessor(bind, 'MAT4', 5126, 0) }];
      this.gltf.animations = animations.map(anim => {
        const samplers = [], channels = [];
        for (const channel of anim.channels) {
          const sampler = samplers.length;
          samplers.push({ input: this.accessor(anim.times, 'SCALAR', 5126, 0, true), output: this.accessor(channel.values.flat(), channel.path === 'rotation' ? 'VEC4' : 'VEC3', 5126, 0), interpolation: 'LINEAR' });
          channels.push({ sampler, target: { node: channel.bone, path: channel.path } });
        }
        return { name: anim.name, samplers, channels, extras: { authoredBoneAnimation: true } };
      });
    }
    let triangles = 0, vertices = 0;
    for (const [mat, mesh] of this.groups) {
      triangles += mesh.idx.length / 3; vertices += mesh.p.length / 3;
      const attributes = { POSITION: this.accessor(mesh.p, 'VEC3', 5126, 34962, true), NORMAL: this.accessor(mesh.n, 'VEC3'), TEXCOORD_0: this.accessor(mesh.uv, 'VEC2') };
      if (this.bones.length) { attributes.JOINTS_0 = this.accessor(mesh.j, 'VEC4', 5123); attributes.WEIGHTS_0 = this.accessor(mesh.w, 'VEC4'); }
      const id = this.gltf.meshes.length;
      this.gltf.meshes.push({ name: mesh.name, primitives: [{ attributes, indices: this.accessor(mesh.idx, 'SCALAR', mesh.p.length / 3 > 65535 ? 5125 : 5123, 34963), material: mat, mode: 4 }] });
      const node = { name: `${this.name}_${this.gltf.materials[mat].name}`, mesh: id }; if (this.bones.length) node.skin = 0;
      this.gltf.scenes[0].nodes.push(this.gltf.nodes.length); this.gltf.nodes.push(node);
    }
    this.gltf.scenes[0].extras = { groundY: 0, artStatus: 'PR02 candidate; requires visual approval', triangleCount: triangles };
    const bin = Buffer.concat(this.binary); this.gltf.buffers[0].byteLength = bin.length;
    const json = Buffer.from(JSON.stringify(this.gltf)); const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
    const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + padded.length + 8 + bin.length, 8);
    const jh = Buffer.alloc(8); jh.writeUInt32LE(padded.length); jh.writeUInt32LE(0x4e4f534a, 4);
    const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
    const data = Buffer.concat([header, jh, padded, bh, bin]), filename = `${this.name}.glb`;
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, filename), data);
    const all = [...this.groups.values()].flatMap(g => g.p), bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    all.forEach((v, i) => { bounds[0][i % 3] = Math.min(bounds[0][i % 3], v); bounds[1][i % 3] = Math.max(bounds[1][i % 3], v); });
    return { file: filename, bytes: data.length, meshes: this.groups.size, vertices, triangles, bones: this.bones.length, clips: animations.map(a => a.name), embeddedImages: this.gltf.images.length, bounds, sha256: createHash('sha256').update(data).digest('hex') };
  }
}

function fox() {
  const m = new Model('fox-guide');
  const orange = m.material('Golden orange fur', 'E68737', 'fur'), cream = m.material('Ivory muzzle and tail', 'FFF0CC', 'fur');
  const teal = m.material('Woven teal explorer vest', '218A9A', 'fabric'), navy = m.material('Deep blue boots and pupil', '1E3049');
  const gold = m.material('Warm brass painted details', 'F6C853'), pink = m.material('Soft inner ear and tongue', 'E99A89', 'fur');
  const white = m.material('Glossy ivory eyes', 'FFFBED', 'satin', .34), brown = m.material('Deep cocoa nose smile', '462E2B', 'satin', .4);
  const iris = m.material('Amber iris', '7D492C', 'satin', .4), darkteal = m.material('Dark teal seams', '155969', 'fabric');
  const root = m.bone('Root', -1, [0, .46, 0]), spine = m.bone('Spine', root, [0, .8, 0]), chest = m.bone('Chest', spine, [0, 1.12, 0]), head = m.bone('Head', chest, [0, 1.52, .03]);
  const arms = {}, legs = {};
  for (const s of [-1, 1]) {
    const suffix = s < 0 ? 'L' : 'R';
    const arm = m.bone(`Arm.${suffix}`, chest, [s * .34, 1.19, 0]);
    const forearm = m.bone(`Forearm.${suffix}`, arm, [s * .59, .98, .055]);
    const paw = m.bone(`Paw.${suffix}`, forearm, [s * .67, .72, .1]);
    arms[s] = { arm, forearm, paw }; legs[s] = m.bone(`Leg.${suffix}`, root, [s * .21, .43, 0]);
  }
  const tail = m.bone('Tail', root, [-.14, .65, -.23]), tailTip = m.bone('TailTip', tail, [-.7, .73, -.47]);
  const torsoWeights = p => { const t = clamp((p[1] - .66) / .55, 0, 1); return [[spine, 1 - t], [chest, t]]; };
  m.sphere([0, .92, 0], [.39, .5, .285], teal, spine, 'Tailored soft explorer suit', 20, 32, 0, torsoWeights);
  m.sphere([0, .99, .267], [.24, .29, .055], cream, chest, 'Cream bib', 16, 24);
  m.tube([[-.31, 1.24, .13], [-.20, 1.15, .26], [0, 1.11, .31], [.20, 1.15, .26], [.31, 1.24, .13]], .043, darkteal, chest, 'Collar piping');
  // Three raised buttons and a five-point sculpted guide medal.
  for (const y of [.79, .92, 1.05]) m.sphere([0, y, .326], [.035, .035, .022], gold, chest, 'Vest buttons', 8, 12);
  m.sphere([-.17, 1.12, .315], [.075, .08, .024], gold, chest, 'Explorer medal', 10, 16);
  m.tube([[-.21, 1.14, .34], [-.17, 1.18, .35], [-.13, 1.14, .34]], .01, cream, chest, 'Raised medal symbol', 6);
  m.box([0, .98, -.28], [.48, .55, .19], .075, darkteal, spine, 'Rounded backpack');
  m.box([0, .92, -.391], [.3, .26, .046], .03, teal, spine, 'Backpack front pocket');
  for (const s of [-1, 1]) {
    const a = arms[s], leg = legs[s];
    m.sphere([s * .24, .34, 0], [.17, .25, .18], orange, leg, 'Short fur legs', 14, 20);
    m.sphere([s * .24, .14, .10], [.197, .14, .265], navy, leg, 'Rounded walking boots', 14, 24);
    m.sphere([s * .24, .058, .105], [.20, .055, .269], darkteal, leg, 'Boot tread and sole', 10, 24);
    m.box([s * .24, .206, .18], [.23, .043, .19], .018, gold, leg, 'Boot ankle buckle', 3);
    m.tube([[s * .34, 1.18, .01], [s * .46, 1.09, .03], [s * .59, .98, .055], [s * .65, .84, .08], [s * .67, .73, .1]], [.14, .13, .118, .105, .1], orange, a.arm, 'Deforming arms', 16, t => t < .5 ? [[a.arm, 1 - t], [a.forearm, t]] : [[a.forearm, (1 - t) * 2], [a.paw, (t - .5) * 2]]);
    m.sphere([s * .675, .68, .115], [.14, .15, .115], cream, a.paw, 'Cream expressive paws', 14, 20);
    for (const o of [-.06, 0, .06]) m.sphere([s * .676 + o, .627, .208], [.03, .045, .015], pink, a.paw, 'Small paw fingers', 8, 10);
    m.tube([[s * .25, 1.27, .20], [s * .27, 1.14, .295], [s * .29, .87, .25]], .028, gold, chest, 'Backpack shoulder straps');
  }
  const tailPoints = Array.from({ length: 19 }, (_, i) => { const t = i / 18; return [-.13 - 1.0 * t, .64 + .53 * t - .12 * Math.sin(t * Math.PI), -.27 - .30 * Math.sin(t * Math.PI / 1.8)]; });
  const tailRadius = tailPoints.map((_, i) => .055 + .20 * Math.sin(i / 18 * Math.PI) ** .65);
  const tw = t => [[tail, 1 - clamp(t * 1.6 - .35, 0, 1)], [tailTip, clamp(t * 1.6 - .35, 0, 1)]];
  m.tube(tailPoints.slice(0, 14), tailRadius.slice(0, 14), orange, tail, 'Sweeping deforming fox tail', 24, t => tw(t * 13 / 18));
  m.tube(tailPoints.slice(13), tailRadius.slice(13), cream, tailTip, 'Cream tail tip', 24, t => tw((13 + t * 5) / 18));
  m.sphere(tailPoints[18], [.058, .058, .058], cream, tailTip, 'Rounded tail tip', 10, 16);
  // Oversized fox head, separate cheek planes and a forward pointed muzzle.
  m.sphere([0, 1.67, .035], [.47, .435, .365], orange, head, 'Fox head silhouette', 24, 40);
  for (const s of [-1, 1]) {
    m.sphere([s * .295, 1.51, .28], [.246, .205, .105], cream, head, 'Cream sculpted cheek', 16, 24, s * -.27);
    m.sphere([s * .437, 1.57, .11], [.14, .095, .17], orange, head, 'Fox cheek ruff', 12, 20, s * -.35);
    // Ear loft widens at base and narrows to a rounded point, with inset pink volume.
    m.tube([[s * .325, 1.945, .015], [s * .357, 2.065, -.005], [s * .384, 2.20, -.024], [s * .397, 2.30, -.03]], [.167, .144, .071, .01], orange, head, 'Pointed fox ears', 20);
    m.sphere([s * .36, 2.09, .103], [.08, .165, .025], pink, head, 'Inset pink ear', 14, 20, s * -.10);
    m.sphere([s * .199, 1.733, .352], [.131, .172, .073], white, head, 'Ivory sculpted eye whites', 16, 24, s * -.07);
    m.sphere([s * .187, 1.723, .417], [.074, .113, .03], iris, head, 'Amber eye iris', 14, 20);
    m.sphere([s * .181, 1.734, .442], [.047, .083, .016], navy, head, 'Deep eye pupil', 14, 20);
    m.sphere([s * .158, 1.779, .456], [.029, .036, .014], white, head, 'Eye sparkle', 10, 12);
    m.sphere([s * .205, 1.690, .452], [.01, .012, .006], white, head, 'Eye second sparkle', 8, 10);
    m.tube([[s * .096, 1.904, .316], [s * .18, 1.937, .30], [s * .27, 1.92, .284]], .028, brown, head, 'Curved eyebrows', 10);
  }
  m.sphere([0, 1.497, .365], [.214, .126, .175], cream, head, 'Fox snout volume', 16, 24);
  m.sphere([0, 1.535, .521], [.079, .059, .064], brown, head, 'Velvet nose', 14, 20);
  m.sphere([-.022, 1.56, .571], [.02, .011, .004], white, head, 'Nose glint', 8, 12);
  m.tube([[0, 1.485, .535], [0, 1.451, .505]], .012, brown, head, 'Nose philtrum', 8);
  for (const s of [-1, 1]) m.tube([[0, 1.452, .510], [s * .06, 1.433, .490], [s * .13, 1.45, .455]], .012, brown, head, 'Warm smile', 8);

  const clip = (name, times, rotations, translations = []) => ({ name, times, channels: [...rotations.map(([bone, axis, angles]) => ({ bone, path: 'rotation', values: angles.map(a => quat(axis, a)) })), ...translations.map(([bone, values]) => ({ bone, path: 'translation', values }))] });
  const idle = clip('Idle', [0, 1, 2, 3, 4], [
    [head, [0, 0, 1], [0, -.055, 0, .055, 0]], [chest, [1, 0, 0], [0, .025, 0, -.015, 0]],
    [tail, [0, 1, 0], [0, .16, 0, -.16, 0]], [tailTip, [0, 1, 0], [.08, -.11, .08, .23, .08]],
    [arms[1].forearm, [1, 0, 0], [0, .08, 0, -.06, 0]],
  ]);
  const cheer = clip('Cheer', [0, .35, .75, 1.1, 1.5, 1.9, 2.2], [
    [arms[-1].arm, [0, 0, 1], [0, -1.55, -1.88, -1.63, -1.9, -1.55, 0]],
    [arms[1].arm, [0, 0, 1], [0, 1.55, 1.88, 1.63, 1.9, 1.55, 0]],
    [arms[-1].forearm, [1, 0, 0], [0, -.4, -.7, -.3, -.7, -.4, 0]], [arms[1].forearm, [1, 0, 0], [0, -.4, -.7, -.3, -.7, -.4, 0]],
    [head, [0, 0, 1], [0, .09, -.09, .09, -.09, .06, 0]], [tail, [0, 1, 0], [0, .27, -.3, .27, -.3, .2, 0]],
  ]);
  const victory = clip('Victory', [0, .4, .8, 1.2, 1.6, 2.0, 2.5, 3], [
    [arms[1].arm, [0, 0, 1], [0, 1.9, 2.3, 1.9, 2.3, 1.9, 1.8, 0]],
    [arms[1].paw, [0, 0, 1], [0, -.2, .35, -.2, .35, -.2, .2, 0]],
    [arms[-1].arm, [0, 0, 1], [0, -.85, -1.1, -.85, -1.1, -.85, -.75, 0]],
    [spine, [0, 0, 1], [0, -.10, .10, -.10, .10, -.10, 0, 0]],
    [head, [0, 1, 0], [0, -.12, .12, -.12, .12, -.12, 0, 0]], [tailTip, [0, 1, 0], [0, -.27, .27, -.27, .27, -.27, 0, 0]],
  ], [[root, [0, .04, .10, .04, .10, .04, 0, 0].map(y => [0, .46 + y, 0])]]);
  return m.finish([idle, cheer, victory]);
}

function mathWorld() {
  const m = new Model('math-world');
  const stone = m.material('Honey limestone masonry', 'EEC998', 'stone'), edge = m.material('Warm stratified island rock', 'A57249', 'rock');
  const rockShade = m.material('Deep ochre cliff strata', '78563E', 'rock'), rockLight = m.material('Sunlit sandstone strata', 'BA8D5F', 'rock');
  const grass = m.material('Living mint grass', '70B67D', 'grass'), leaf = m.material('Deep jade leaves', '30946E', 'grass');
  const freshGrass = m.material('Fresh lime grass tips', '9DCF82', 'grass');
  const blue = m.material('Glazed blue castle roofs', '377FAB', 'satin', .52), turquoise = m.material('Turquoise glazed roof band', '56B9B4', 'satin', .5);
  const gold = m.material('Gold painted math sculptures', 'F6C357', 'satin', .5), door = m.material('Walnut arched door', '82533D', 'wood');
  const recess = m.material('Deep window recess', '273D5C'), ivory = m.material('Pale paving and trim', 'F5E5C6', 'stone');
  const flower = m.material('Coral learning garden', 'EA9778', 'satin'), banner = m.material('Teal woven banner', '218C99', 'fabric');
  const glass = m.material('Amber glazed learning room windows', 'EBC88A', 'satin', .33);

  // These helpers are local to the island. Fox geometry, rig and clips stay byte-identical.
  const face = (points, mat, name, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
    const mesh = m.mesh(mat, name), base = mesh.p.length / 3;
    const normal = norm(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    points.forEach((p, i) => m.vertex(mesh, p, normal, uv[i]));
    for (let i = 1; i < points.length - 1; i++) mesh.idx.push(base, base + i, base + i + 1);
  };
  const ringPoint = (a, radius, y, ring = 0) => {
    const shape = 1 + .032 * Math.sin(a * 5 + .3) + .022 * Math.cos(a * 9 - .4) + .018 * Math.sin(a * 3 + ring * .65);
    return [Math.cos(a) * radius * shape + .035 * ring, y + (ring ? .018 * Math.sin(a * 7 + ring) : 0), Math.sin(a) * radius * shape];
  };
  const cliffRings = [[2.0, -.055], [1.99, -.22], [1.77, -.48], [1.60, -.71], [1.29, -1.00], [.80, -1.28], [.31, -1.47]];
  const strata = [rockLight, edge, rockLight, edge, rockShade, rockShade];
  const sides = 40;
  for (let layer = 0; layer < cliffRings.length - 1; layer++) {
    const [r0, y0] = cliffRings[layer], [r1, y1] = cliffRings[layer + 1];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * TAU, b = (i + 1) / sides * TAU;
      face([ringPoint(a, r0, y0, layer), ringPoint(b, r0, y0, layer), ringPoint(b, r1, y1, layer + 1), ringPoint(a, r1, y1, layer + 1)], strata[layer], 'Angular layered floating sandstone cliff');
    }
  }
  // Close the underside and top; the broad meadow remains the gameplay ground at Y=0.
  for (let i = 0; i < sides; i++) {
    const a = i / sides * TAU, b = (i + 1) / sides * TAU;
    face([[.21, -1.51, 0], ringPoint(a, .31, -1.47, 6), ringPoint(b, .31, -1.47, 6)], rockShade, 'Closed pointed island underside');
    face([[0, .006, 0], ringPoint(b, 2.0, .006), ringPoint(a, 2.0, .006)], grass, 'Irregular grass meadow crown');
    face([ringPoint(a, 2.0, .006), ringPoint(b, 2.0, .006), ringPoint(b, 2.0, -.055), ringPoint(a, 2.0, -.055)], grass, 'Thick organic grass rim');
  }
  const boulder = (center, scale, seed, material) => {
    const rings = [[.26, -.65], [1, -.26], [.79, .50], [.20, .83]], count = 7;
    const point = (i, ring) => {
      i = (i % count + count) % count;
      const angle = i / count * TAU + seed, [radius, y] = rings[ring];
      const skew = 1 + .16 * Math.sin(i * 2.7 + seed * 3 + ring * 1.4);
      return add(center, [Math.cos(angle) * radius * scale[0] * skew, y * scale[1], Math.sin(angle) * radius * scale[2] * skew]);
    };
    for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < count; i++) {
      face([point(i, ring), point(i + 1, ring), point(i + 1, ring + 1), point(i, ring + 1)], material, 'Individual angular cliff outcrops');
    }
    for (let i = 0; i < count; i++) {
      face([add(center, [0, scale[1] * .87, 0]), point(i + 1, 3), point(i, 3)], material, 'Closed cliff outcrop peaks');
      face([add(center, [0, -scale[1] * .69, 0]), point(i, 0), point(i + 1, 0)], material, 'Closed cliff outcrop bases');
    }
  };
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU + .1, r = 1.65 + (i % 3) * .055;
    boulder([Math.cos(a) * r, -.36 - (i % 3) * .1, Math.sin(a) * r], [.15 + (i % 4) * .024, .23 + (i % 3) * .038, .13 + (i % 3) * .02], a, i % 4 ? edge : rockLight);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + .27;
    boulder([Math.cos(a) * 1.18 + .11, -.98, Math.sin(a) * 1.18], [.16, .24, .17], a * .7, rockShade);
  }

  const tuft = (x, z, height, angle) => {
    for (let j = -1; j <= 1; j++) {
      const a = angle + j * .65, dx = Math.cos(a) * .031, dz = Math.sin(a) * .031;
      const base = [x + j * .014, .013, z], tip = [x + Math.cos(a) * height * .32, height, z + Math.sin(a) * height * .32];
      face([add(base, [-dx, 0, -dz]), add(base, [dx, 0, dz]), tip], j ? grass : freshGrass, 'Hand modeled grass blade clusters', [[0, 0], [1, 0], [.5, 1]]);
      face([tip, add(base, [dx, 0, dz]), add(base, [-dx, 0, -dz])], j ? grass : freshGrass, 'Hand modeled grass blade clusters', [[.5, 1], [1, 0], [0, 0]]);
    }
  };
  // Broken tufts and moss scallops soften the silhouette without turning the lip into a torus.
  for (let i = 0; i < 42; i++) {
    const a = i / 42 * TAU, r = 1.88 + .025 * Math.sin(a * 7);
    tuft(Math.cos(a) * r, Math.sin(a) * r, .065 + (i % 4) * .012, a);
    if (i % 2 === 0) m.sphere([Math.cos(a) * 1.975, -.016, Math.sin(a) * 1.975], [.12, .038, .085], grass, 0, 'Loose moss scallops along meadow edge', 5, 8);
  }

  // Pale individual slabs bend towards the castle; low balustrades mark its raised approach.
  for (let i = 0; i < 10; i++) {
    const t = i / 9, z = 1.84 - t * 1.77, x = .14 * Math.sin(t * Math.PI * 1.4);
    m.box([x, .038 + .05 * t, z], [.57 - .13 * t, .085, .174], .028, ivory, 0, 'Curving limestone stepping path', 3);
    for (const s of [-1, 1]) m.box([x + s * (.285 - .065 * t), .034 + .05 * t, z], [.07, .068, .16], .02, stone, 0, 'Individual path edge stones', 2);
  }
  for (const s of [-1, 1]) {
    const x = s * .38;
    for (let i = 0; i < 4; i++) {
      const z = .60 - i * .19;
      m.tapered([x, .19 + i * .016, z], .25, .043, .035, ivory, 'Approach carved stone balusters', 8);
      m.sphere([x, .33 + i * .016, z], [.049, .035, .049], gold, 0, 'Baluster warm brass caps', 5, 8);
    }
    m.tube([[x, .305, .64], [x, .363, -.02]], .028, ivory, 0, 'Approach continuous rounded stone railing', 8);
  }
  for (let i = 0; i < 3; i++) m.box([0, .073 + i * .054, -.01 - i * .062], [.66 - i * .04, .12, .25], .032, ivory, 0, 'Castle entrance graduated steps', 3);
  m.box([0, .20, -.55], [1.68, .4, .91], .12, stone, 0, 'Castle raised foundation', 5);
  m.box([0, .045, -.55], [1.80, .09, 1.02], .035, ivory, 0, 'Castle foundation plinth', 3);
  m.box([0, 1.04, -.55], [.91, 1.6, .82], .10, stone, 0, 'Central mathematics keep', 7);
  for (const y of [.46, 1.04, 1.68]) m.box([0, y, -.55], [.96, .045, .88], .018, ivory, 0, 'Keep carved horizontal stone courses', 2);
  for (const s of [-1, 1]) for (const y of [.62, .91, 1.21, 1.50]) m.box([s * .433, y, -.125], [.084, .12, .07], .015, ivory, 0, 'Keep staggered corner quoins', 2);
  m.box([0, 1.785, -.55], [1.09, .15, .99], .045, ivory, 0, 'Keep upper cornice', 4);
  m.tapered([0, 2.285, -.55], 1.0, .72, .05, blue, 'Central blue roof', 4);
  // Raised ridge ribs and two glazed courses give the pyramid an authored roof structure.
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    m.tube([[Math.cos(a) * .70, 1.80, -.55 + Math.sin(a) * .70], [Math.cos(a) * .36, 2.30, -.55 + Math.sin(a) * .36], [Math.cos(a) * .055, 2.79, -.55 + Math.sin(a) * .055]], .018, turquoise, 0, 'Keep glazed diagonal roof ribs', 6);
  }
  for (const y of [2.06, 2.36]) {
    const radius = .72 - (y - 1.785) * .67;
    m.tapered([0, y, -.55], .026, radius + .009, radius - .009, turquoise, 'Keep thin glazed roof courses', 4);
  }
  m.tapered([0, 2.865, -.55], .17, .085, .018, gold, 'Central roof finial', 24);
  m.sphere([0, 2.966, -.55], [.033, .034, .033], gold, 0, 'Roof pearl', 10, 16);
  const window = (x, bottom, z, width, height) => {
    m.arch(x, bottom - .026, z, width + .055, height + .054, .034, ivory);
    m.arch(x, bottom, z + .024, width, height, .024, recess);
    m.arch(x, bottom + .026, z + .040, width - .044, height - .047, .015, glass);
    m.tube([[x, bottom + .028, z + .055], [x, bottom + height - .05, z + .055]], .012, gold, 0, 'Carved arched window central mullions', 6);
    m.tube([[x - width * .39, bottom + height * .48, z + .055], [x + width * .39, bottom + height * .48, z + .055]], .010, gold, 0, 'Arched window cross transoms', 6);
    m.box([x, bottom - .025, z + .045], [width + .084, .043, .094], .012, ivory, 0, 'Window projecting limestone sill', 2);
  };
  const pennant = (x, y, z, width, height) => {
    const front = [[x - width / 2, y, z], [x + width / 2, y, z], [x + width / 2, y - height * .82, z + .014], [x, y - height, z + .023], [x - width / 2, y - height * .82, z + .014]];
    face([...front].reverse(), banner, 'Teal woven swallowtail heraldic pennants', [[0, 0], [.5, 1], [1, .82], [1, 0], [0, 0]]);
    face(front.map(p => add(p, [0, 0, -.006])), banner, 'Teal woven swallowtail heraldic pennants', [[0, 0], [1, 0], [1, .82], [.5, 1], [0, .82]]);
    m.tube([[x - width * .66, y + .021, z], [x + width * .66, y + .021, z]], .012, gold, 0, 'Pennant horizontal brass hanger', 6);
    m.box([x, y - height * .36, z + .014], [width * .58, .018, .012], .004, gold, 0, 'Pennant raised golden learning glyph', 1);
    m.box([x, y - height * .36, z + .016], [.018, width * .58, .013], .004, gold, 0, 'Pennant raised golden learning glyph', 1);
  };
  // Towers retain a strong round silhouette, with separate roof eaves, ribs and carved windows.
  for (const s of [-1, 1]) {
    const x = s * .81, z = -.58;
    m.tapered([x, .865, z], 1.68, .32, .305, stone, 'Round castle towers', 40);
    for (const y of [.13, .64, 1.19, 1.63]) m.tapered([x, y, z], .074, .334, .334, ivory, 'Tower carved cornices', 40);
    m.tapered([x, .067, z], .12, .36, .345, ivory, 'Tower flared base molding', 32);
    m.tapered([x, 1.86, z], .43, .415, .17, blue, 'Round turquoise tower roof', 40);
    m.tapered([x, 1.692, z], .07, .422, .422, turquoise, 'Roof glazed band', 40);
    m.tapered([x, 2.137, z], .18, .17, .01, blue, 'Tower pointed roof', 40);
    for (const [y, r] of [[1.81, .333], [1.94, .26], [2.07, .181]]) m.tapered([x, y, z], .021, r + .009, r - .009, turquoise, 'Tower thin glazed roof courses', 32);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      m.tube([[x + Math.cos(a) * .414, 1.715, z + Math.sin(a) * .414], [x + Math.cos(a) * .171, 2.074, z + Math.sin(a) * .171], [x + Math.cos(a) * .018, 2.220, z + Math.sin(a) * .018]], .009, turquoise, 0, 'Tower radial glazed roof seams', 5);
    }
    m.sphere([x, 2.238, z], [.045, .055, .045], gold, 0, 'Tower gold roof pearl', 10, 16);
    window(x, .81, z + .293, .18, .38);
    window(x, .23, z + .305, .14, .25);
    pennant(x, 1.58, z + .322, .14, .29);
    // Exposed side quoins catch the light as the camera travels around the castle.
    for (const y of [.39, .96, 1.43]) for (const offset of [-.21, .21]) m.box([x + offset, y, z + .221], [.071, .086, .05], .014, ivory, 0, 'Tower exposed sandstone accent blocks', 2);
  }
  // Main door is an extruded arched opening with carved pale surrounding arch.
  m.arch(0, .20, -.11, .59, .82, .06, ivory);
  m.arch(0, .235, -.068, .43, .67, .037, recess);
  m.arch(0, .235, -.037, .405, .646, .022, door);
  m.tube([[0, .25, -.015], [0, .76, -.015]], .010, gold, 0, 'Door center seam', 8);
  for (const x of [-.14, -.07, .07, .14]) m.tube([[x, .27, -.014], [x, .77 - Math.abs(x) * .3, -.014]], .005, rockShade, 0, 'Individual walnut door planks', 5);
  for (const y of [.34, .64]) m.box([0, y, -.009], [.368, .033, .024], .009, gold, 0, 'Raised door brass cross straps', 2);
  for (let i = 0; i < 9; i++) {
    const a = i / 8 * Math.PI;
    m.sphere([Math.cos(a) * .253, .735 + Math.sin(a) * .253, -.065], [.037, .032, .028], stone, 0, 'Door individual arch keystones', 5, 8);
  }
  for (const s of [-1, 1]) {
    m.sphere([s * .055, .47, .009], [.016, .016, .009], gold, 0, 'Door knobs', 8, 12);
    window(s * .237, 1.15, -.136, .16, .29);
    pennant(s * .40, 1.14, -.058, .105, .44);
  }
  m.sphere([0, 1.435, -.124], [.15, .15, .025], turquoise, 0, 'Round mathematics crest', 12, 24);
  m.tube(Array.from({ length: 25 }, (_, i) => [Math.cos(i / 24 * TAU) * .153, 1.435 + Math.sin(i / 24 * TAU) * .153, -.098]), .012, gold, 0, 'Mathematics crest raised brass frame', 6);
  m.box([0, 1.435, -.088], [.18, .044, .033], .012, gold, 0, 'Sculpted plus crest', 3);
  m.box([0, 1.435, -.087], [.044, .18, .033], .012, gold, 0, 'Sculpted plus crest', 3);
  // True geometry number monuments: two, three, and equals sculpted in round strokes.
  const number = (cx, cz, kind) => {
    m.tapered([cx, .085, cz], .17, .28, .25, ivory, 'Math sculpture pedestal', 32);
    let strokes;
    if (kind === '2') strokes = [[[-.15, .64], [-.10, .74], [0, .77], [.14, .72], [.16, .62], [.1, .54], [-.13, .32], [.16, .32]]];
    else strokes = [[[-.13, .74], [.04, .77], [.15, .70], [.14, .59], [.015, .53], [.14, .47], [.15, .36], [.04, .29], [-.13, .31]]];
    for (const stroke of strokes) m.tube(stroke.map(([x, y]) => [cx + x, y, cz]), .048, gold, 0, `Original modeled number ${kind}`, 12);
    m.tube([[cx, .17, cz], [cx, .31, cz]], .038, gold, 0, 'Number stand', 12);
  };
  number(-1.30, .69, '2'); number(1.33, .60, '3');
  m.box([.99, .29, 1.23], [.32, .063, .064], .022, turquoise, 0, 'Sculpted equals symbol', 4);
  m.box([.99, .42, 1.23], [.32, .063, .064], .022, turquoise, 0, 'Sculpted equals symbol', 4);
  m.tapered([.99, .06, 1.23], .12, .24, .21, ivory, 'Equals pedestal', 24);
  // Garden shrubs frame the landmarks; low patches connect the trees to the meadow.
  for (const [x, z, scale] of [[-1.44, -.66, .8], [1.37, -.87, .85], [-1.05, 1.37, .48], [.69, -1.58, .6]]) {
    m.tube([[x, .03, z], [x, .44 * scale, z]], .049 * scale, door, 0, 'Garden tree trunk', 10);
    for (const [dx, dy, dz, r] of [[0, .43, 0, .28], [-.13, .35, .045, .18], [.14, .35, -.04, .2]]) m.sphere([x + dx * scale, dy * scale, z + dz * scale], [r * scale, r * 1.1 * scale, r * scale], leaf, 0, 'Layered round garden leaves', 10, 16);
    m.sphere([x - .07 * scale, .56 * scale, z + .11 * scale], [.17 * scale, .12 * scale, .16 * scale], grass, 0, 'Garden tree sunlit crown', 8, 12);
  }
  for (const [patch, [x, z]] of [[-1.56, .25], [1.55, .07], [-.66, 1.55], [.53, 1.54], [-1.1, -1.23], [1.19, -1.3], [-.73, .51], [.78, .47]].entries()) {
    m.sphere([x, .06, z], [.19, .065, .16], leaf, 0, 'Low deep green garden moss', 6, 10);
    m.sphere([x - .075, .077, z + .035], [.13, .064, .11], grass, 0, 'Layered garden ground cover', 6, 10);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + patch, px = x + Math.cos(a) * .155, pz = z + Math.sin(a) * .115;
      tuft(px, pz, .10 + i % 2 * .035, a);
    }
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + patch, fx = x + Math.cos(a) * .073, fz = z + Math.sin(a) * .055, fy = .17 + i * .025;
      m.tube([[fx, .058, fz], [fx + .011, fy, fz]], .007, leaf, 0, 'Garden flower stems', 5);
      for (let petal = 0; petal < 5; petal++) {
        const p = petal / 5 * TAU;
        m.sphere([fx + .028 * Math.cos(p), fy, fz + .028 * Math.sin(p)], [.026, .013, .024], patch % 2 ? ivory : flower, 0, 'Five petal coral and ivory garden blossoms', 4, 7);
      }
      m.sphere([fx, fy + .009, fz], [.018, .013, .018], gold, 0, 'Warm gold flower centers', 4, 7);
    }
  }
  return m.finish();
}

const report = [fox(), mathWorld()];
console.log(JSON.stringify({ generator: 'tools/generate_v37_slice_assets.mjs', status: 'PR02 authored candidate, pending art approval', assets: report }, null, 2));
