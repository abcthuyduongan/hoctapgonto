/** Original PR03 forest candidate. Node-only, deterministic geometry and embedded PBR maps. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Model, TAU, add, sub, cross, norm, png } from './generate_v37_slice_assets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const protectedFiles = ['fox-guide.glb', 'math-world.glb'];
const hashes = () => Object.fromEntries(protectedFiles.map(name => [name,
  createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public/models', name))).digest('hex')]));
const before = hashes();

class ForestModel extends Model {
  finish() {
    const report = super.finish();
    this.gltf.scenes[0].extras.artStatus = 'PR03 candidate; requires visual approval';
    const binary = Buffer.concat(this.binary);
    const json = Buffer.from(JSON.stringify(this.gltf));
    const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
    const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + padded.length + binary.length, 8);
    const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(padded.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binaryHeader = Buffer.alloc(8); binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4);
    const bytes = Buffer.concat([header, jsonHeader, padded, binaryHeader, binary]);
    fs.writeFileSync(path.join(ROOT, 'public/models/memory-world.glb'), bytes);
    return { ...report, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  texture(kind) {
    if (!['leaf', 'moss', 'water', 'bark'].includes(kind)) return super.texture(kind);
    if (this.maps.has(kind)) return this.maps.get(kind);
    const size = 192;
    const height = (x, y) => {
      const u = x / size * TAU, v = y / size * TAU;
      if (kind === 'leaf') {
        const central = Math.exp(-(((x / size - .5) * 40) ** 2)) * .17;
        const veins = Math.cos(v * 9 + Math.abs(u - Math.PI) * 6) * .055;
        return .48 + central + veins + Math.sin(u * 27) * Math.cos(v * 23) * .025;
      }
      if (kind === 'water') return .52 + Math.sin(v * 7 + Math.sin(u * 3)) * .065
        + Math.cos(u * 11 - v * 4) * .025;
      if (kind === 'bark') return .48 + Math.sin(u * 13 + Math.sin(v * 3) * .7) * .12
        + Math.cos(u * 37 + v * 2) * .04 + Math.sin(v * 14) * .025;
      return .5 + Math.sin(u * 18 + Math.cos(v * 11)) * Math.cos(v * 19 + u * 3) * .06
        + Math.sin(u * 37) * Math.cos(v * 41) * .033;
    };
    const data = {
      base: png(size, size, (x, y) => {
        const h = height(x, y), brightness = 207 + h * 66;
        return kind === 'leaf' ? [brightness * .91, brightness, brightness * .92, 255]
          : kind === 'water' ? [brightness * .9, brightness, 246, 255] : [brightness, brightness, brightness, 255];
      }),
      normal: png(size, size, (x, y) => {
        const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y);
        const dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
        return [...norm([-dx * 1.5, -dy * 1.5, 1]).map(v => (v * .5 + .5) * 255), 255];
      }),
      rough: png(size, size, (x, y) => [255, (kind === 'water' ? 77 : 179) + height(x, y) * 45, 0, 255]),
    };
    const ids = {};
    for (const [role, bytes] of Object.entries(data)) {
      const source = this.gltf.images.length;
      this.gltf.images.push({ name: `forest_${kind}_${role}_${size}`, mimeType: 'image/png', bufferView: this.bytes(bytes) });
      ids[role] = this.gltf.textures.length;
      this.gltf.textures.push({ name: `forest_${kind}_${role}`, source, sampler: 0 });
    }
    this.maps.set(kind, ids); return ids;
  }
}

const m = new ForestModel('memory-world');
m.gltf.asset.generator = 'Bao An original authored forest generator V3.7 PR03';
m.gltf.asset.extras = { provenance: 'ORIGINAL_PROCEDURAL_V37_PR03', source: 'tools/generate_v37_memory_asset.mjs',
  acceptance: 'candidate-not-art-approved', externalAssets: [], landing: [-.95, .04, 1.25],
  features: ['closed layered cliffs', '4 branching trees', 'sculpted leaf canopies', 'arched wooden bridge',
    'shallow textured pond', 'curving stepping path', '2 pairs of raised memory symbols', 'flowers and mushrooms'] };
const mat = {
  rock: m.material('Forest weathered limestone cliff', 'AC9B78', 'rock'),
  rockDark: m.material('Forest deep sediment seams', '797B62', 'rock'),
  rockLight: m.material('Forest pale exposed cliff faces', 'D6C6A5', 'rock'),
  grass: m.material('Forest grass and soft moss carpet', '79B88C', 'moss'),
  moss: m.material('Forest deep moss roots and ground cover', '4E9673', 'moss'),
  bark: m.material('Forest warm sculpted bark', 'A67C57', 'bark'),
  wood: m.material('Forest honey bridge planks', 'D7B78A', 'wood'),
  leafDark: m.material('Forest deep jade leaf undersides', '377B65', 'leaf'),
  leaf: m.material('Forest sage leaf canopies', '70AA85', 'leaf'),
  leafLight: m.material('Forest sunlit lime leaf crowns', 'A3C891', 'leaf'),
  ivory: m.material('Forest ivory memory tablets and petals', 'FFF0CF', 'stone'),
  teal: m.material('Forest teal raised memory symbols', '3A9A9C', 'satin', .7),
  gold: m.material('Forest warm gold symbols and flower centers', 'EAC374', 'satin', .75),
  coral: m.material('Forest coral mushrooms and blossoms', 'DD947B', 'satin'),
  water: m.material('Forest shallow turquoise pond', '79BDB8', 'water', .42),
};

const triangle = (a, b, c, material, name, uv) => {
  const mesh = m.mesh(material, name), normal = norm(cross(sub(b, a), sub(c, a)));
  const points = [a, b, c];
  const base = mesh.p.length / 3;
  points.forEach((p, index) => m.vertex(mesh, p, normal, uv?.[index] ?? [(p[0] + 2.1) / 4.2, (p[2] + 2.1) / 4.2]));
  mesh.idx.push(base, base + 1, base + 2);
};
const quad = (a, b, c, d, material, name) => {
  triangle(a, b, c, material, name); triangle(a, c, d, material, name);
};
const ringPoint = (angle, radius, y, phase = 0) => {
  const edge = 1 + Math.sin(angle * 5 + phase) * .038 + Math.cos(angle * 9 - phase) * .025;
  return [Math.cos(angle) * radius * edge, y, Math.sin(angle) * radius * edge * .94];
};

// Closed, visibly layered floating landform. Every ring changes phase and profile.
const sides = 56;
const profiles = [[2, -.03, 0], [1.99, -.22, .3], [1.85, -.59, .9], [1.53, -.92, 1.7], [1.03, -1.19, 2.1], [.34, -1.46, 2.7]];
for (let ring = 0; ring < profiles.length - 1; ring++) {
  const [radiusA, yA, phaseA] = profiles[ring], [radiusB, yB, phaseB] = profiles[ring + 1];
  for (let index = 0; index < sides; index++) {
    const angle = index / sides * TAU, next = (index + 1) / sides * TAU;
    const a = ringPoint(angle, radiusA, yA, phaseA), b = ringPoint(next, radiusA, yA, phaseA);
    const c = ringPoint(next, radiusB, yB, phaseB), d = ringPoint(angle, radiusB, yB, phaseB);
    const material = ring === 0 ? mat.moss : ring === 2 ? mat.rockDark : index % 7 === 0 ? mat.rockLight : mat.rock;
    quad(a, b, c, d, material, 'Closed hand-shaped forest cliff strata');
  }
}
for (let index = 0; index < sides; index++) {
  const angle = index / sides * TAU, next = (index + 1) / sides * TAU;
  triangle([.06, -1.49, -.03], ringPoint(angle, .34, -1.46, 2.7), ringPoint(next, .34, -1.46, 2.7), mat.rockDark, 'Closed forest pointed underside');
  triangle([0, 0, 0], ringPoint(next, 2, -.003), ringPoint(angle, 2, -.003), mat.grass, 'Flat grass meadow ground surface Y0');
}

// Irregular broadleaf crowns: closed lobed surfaces, flattened tiers, no generic spheres.
function canopy(center, radius, material, seed) {
  const mesh = m.mesh(material, 'Sculpted layered broadleaf canopy');
  const rings = 7, segments = 13, base = mesh.p.length / 3;
  for (let row = 0; row <= rings; row++) {
    for (let column = 0; column <= segments; column++) {
      const phi = row / rings * Math.PI, angle = column / segments * TAU;
      const lobe = 1 + Math.sin(angle * 5 + seed) * .115 + Math.cos(angle * 3 - phi * 2 + seed) * .075;
      const x = Math.sin(phi) * Math.cos(angle) * radius[0] * lobe;
      const y = Math.cos(phi) * radius[1] * (1 + Math.sin(angle * 3 + seed) * .06);
      const z = Math.sin(phi) * Math.sin(angle) * radius[2] * lobe;
      const normal = [x / radius[0] ** 2, y / radius[1] ** 2, z / radius[2] ** 2];
      m.vertex(mesh, add(center, [x, y, z]), normal, [column / segments, row / rings]);
    }
  }
  for (let row = 0; row < rings; row++) for (let column = 0; column < segments; column++) {
    const a = base + row * (segments + 1) + column, b = a + segments + 1;
    if (row > 0) mesh.idx.push(a, a + 1, b + 1);
    if (row < rings - 1) mesh.idx.push(a, b + 1, b);
  }
}
function leaf(center, length, width, angle, material) {
  const point = (x, y, z) => add(center, [x * Math.cos(angle) - z * Math.sin(angle), y,
    x * Math.sin(angle) + z * Math.cos(angle)]);
  const outline = [[0, 0, -length / 2], [width * .8, .035, -length * .22], [width, .065, length * .13],
    [width * .58, .05, length * .34], [0, 0, length / 2], [-width * .58, .05, length * .34],
    [-width, .065, length * .13], [-width * .8, .035, -length * .22]];
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index], b = outline[(index + 1) % outline.length];
    triangle(point(0, .07, 0), point(...b), point(...a), material, 'Individual pointed folded broad leaves');
    triangle(point(0, -.008, 0), point(a[0], a[1] - .014, a[2]), point(b[0], b[1] - .014, b[2]), mat.leafDark, 'Closed leaf underside');
    quad(point(...a), point(a[0], a[1] - .014, a[2]), point(b[0], b[1] - .014, b[2]), point(...b), material, 'Closed leaf thin edge');
  }
  m.tube([point(0, .073, -length * .4), point(0, .081, 0), point(0, .073, length * .36)], .0048, mat.leafLight, 0, 'Raised broadleaf central veins', 5);
}

const trees = [
  { x: -1.18, z: -.84, height: 2.32, crown: .66, lean: .13, seed: 1 },
  { x: 1.18, z: -.72, height: 2.62, crown: .64, lean: -.13, seed: 3 },
  { x: .04, z: -1.38, height: 2.38, crown: .61, lean: -.09, seed: 5 },
  { x: 1.48, z: .64, height: 1.9, crown: .48, lean: -.12, seed: 7 },
];
trees.forEach(({ x, z, height, crown, lean, seed }) => {
  m.tube([[x, .01, z], [x + lean * .2, height * .23, z + .01], [x + lean * .7, height * .49, z - .035],
    [x + lean, height * .73, z + .025]], [.17, .14, .105, .055], mat.bark, 0, 'Tapered bending forest trunks', 13);
  for (let root = 0; root < 5; root++) {
    const angle = root / 5 * TAU + seed;
    m.tube([[x, .19, z], [x + Math.cos(angle) * .18, .045, z + Math.sin(angle) * .16],
      [x + Math.cos(angle) * .37, .018, z + Math.sin(angle) * .31]], [.085, .054, .015], mat.bark, 0, 'Sculpted exposed tree roots', 7);
  }
  for (let branch = 0; branch < 4; branch++) {
    const angle = branch / 4 * TAU + seed * .4;
    const tip = [x + lean + Math.cos(angle) * crown * .5, height * (.78 + branch % 2 * .035), z + Math.sin(angle) * crown * .48];
    m.tube([[x + lean * .6, height * .48, z], [x + lean + Math.cos(angle) * crown * .3, height * .64, z + Math.sin(angle) * crown * .3], tip],
      [.065, .04, .018], mat.bark, 0, 'Forked sculpted tree branches', 8);
    const center = add(tip, [0, .04, 0]);
    canopy(center, [crown * .62, .29, crown * .55], branch % 2 ? mat.leaf : mat.leafDark, seed + branch);
    for (let index = 0; index < 4; index++) {
      const a = index / 4 * TAU + branch;
      leaf(add(center, [Math.cos(a) * crown * .34, .225, Math.sin(a) * crown * .3]), .23, .058, a + seed, mat.leafLight);
    }
  }
  canopy([x + lean, height * .87, z], [crown * .69, .33, crown * .61], mat.leaf, seed + 2);
  canopy([x + lean * 1.2, height * .92, z - .03], [crown * .46, .23, crown * .45], mat.leafLight, seed + 5);
  for (let index = 0; index < 5; index++) {
    const a = index / 5 * TAU;
    leaf([x + lean + Math.cos(a) * crown * .22, height * .92 + .205, z + Math.sin(a) * crown * .25], .25, .066, a + seed, mat.leafLight);
  }
});

// Shallow pond with modeled limestone bank and flowing surface ripple geometry.
const pond = [-.39, .006, -.04], pondRadius = [.63, .48];
for (let index = 0; index < 40; index++) {
  const a = index / 40 * TAU, b = (index + 1) / 40 * TAU;
  const point = angle => [pond[0] + Math.cos(angle) * pondRadius[0], pond[1], pond[2] + Math.sin(angle) * pondRadius[1]];
  triangle(pond, point(b), point(a), mat.water, 'Shallow turquoise forest pond');
  const angle = (index + .5) / 40 * TAU;
  if (index % 2 === 0) m.sphere([pond[0] + Math.cos(angle) * .665, .017, pond[2] + Math.sin(angle) * .515],
    [.085, .044, .067], index % 4 ? mat.rockLight : mat.moss, 0, 'Individual mossy pond bank stones', 4, 7, angle * .3);
}
for (let ripple = 0; ripple < 4; ripple++) {
  const x = -.65 + ripple * .17, z = .08 + Math.sin(ripple * 1.8) * .15;
  m.tube(Array.from({ length: 8 }, (_, index) => [x + Math.cos(index / 7 * Math.PI) * .09, .014,
    z + Math.sin(index / 7 * Math.PI) * .034]), .006, mat.ivory, 0, 'Raised pale water ripple arcs', 5);
}

// Arched bridge is genuine joined timber with individually beveled plank ends.
const bridge = { x: -.3, z: -.02 };
const bridgeY = t => .16 + Math.sin(t * Math.PI) * .15;
for (let plank = 0; plank < 9; plank++) {
  const t = plank / 8;
  m.box([bridge.x - .55 + t * 1.1, bridgeY(t), bridge.z], [.125, .065, .40], .018, mat.wood, 0, 'Individual arched honey bridge planks', 2);
  for (const side of [-1, 1]) m.sphere([bridge.x - .55 + t * 1.1, bridgeY(t) + .04, bridge.z + side * .12],
    [.010, .009, .010], mat.gold, 0, 'Bridge brass peg heads', 3, 5);
}
for (const side of [-1, 1]) {
  const rail = Array.from({ length: 11 }, (_, index) => {
    const t = index / 10;
    return [bridge.x - .57 + t * 1.14, bridgeY(t) + .29, bridge.z + side * .24];
  });
  m.tube(rail, .024, mat.bark, 0, 'Closed curved wooden bridge handrails', 8);
  for (const t of [0, .25, .75, 1]) m.tube([[bridge.x - .55 + t * 1.1, bridgeY(t), bridge.z + side * .24],
    [bridge.x - .55 + t * 1.1, bridgeY(t) + .3, bridge.z + side * .24]], [.022, .018], mat.bark, 0, 'Wooden bridge rail posts', 7);
}

// A curved stepping path retains an open .45 m landing disc around the fox feet.
const pathStones = [[-.34, 1.57], [-.26, 1.28], [-.20, 1.03], [-.07, .80], [.13, .53],
  [.26, .25], [.39, -.12], [.40, -.40], [.27, -.69], [.06, -.88]];
pathStones.forEach(([x, z], index) => {
  m.sphere([x, .016, z], [.145 + index % 2 * .028, .035, .11 + index % 3 * .014], mat.rockLight, 0,
    'Curving individual cream stepping stones', 5, 10, Math.sin(index) * .12);
});

// Two physical pairs of geometry symbols, never text baked into a screenshot.
function tablet(x, z, type, material, turn) {
  m.box([x, .045, z], [.37, .085, .28], .025, mat.rockLight, 0, 'Memory tablet mossy plinth', 3);
  m.box([x, .32, z], [.30, .49, .085], .025, mat.ivory, 0, 'Ivory raised paired memory tablets', 3);
  const shape = type === 'diamond'
    ? [[0, .46], [.09, .33], [0, .20], [-.09, .33], [0, .46]]
    : Array.from({ length: 13 }, (_, index) => [Math.cos(index / 12 * TAU) * .078, .335 + Math.sin(index / 12 * TAU) * .09]);
  m.tube(shape.map(([dx, y]) => [x + dx, y, z + .055]), .018, material, 0, `Raised matching ${type} memory symbols`, 7);
  m.tube([[x, .12, z + .05], [x, .19, z + .05]], .012, material, 0, 'Memory tablet small bottom stem', 6);
  // The lightly turned tiny leaf accent makes four tablets individually authored.
  leaf([x + .11, .072, z - .075], .10, .026, turn, mat.moss);
}
tablet(-1.26, .44, 'diamond', mat.teal, .1); tablet(.83, .98, 'diamond', mat.teal, 1.1);
tablet(-.74, -.88, 'circle', mat.gold, .3); tablet(.86, -.25, 'circle', mat.gold, 1.8);

// Rim groundcover avoids the left-front landing zone and makes the grass volumetric.
const patches = [[-1.56, -.18], [-1.65, .75], [.55, 1.57], [1.4, 1.1], [1.39, -1.08], [-.56, -1.51], [.65, -.88]];
patches.forEach(([x, z], patch) => {
  canopy([x, .08, z], [.22, .10, .17], mat.moss, patch);
  for (let index = 0; index < 5; index++) {
    const a = index / 5 * TAU + patch;
    leaf([x + Math.cos(a) * .16, .035, z + Math.sin(a) * .14], .16, .038, a, index % 2 ? mat.grass : mat.moss);
  }
  for (let flower = 0; flower < 2; flower++) {
    const fx = x + Math.sin(patch + flower) * .1, fz = z + Math.cos(patch + flower) * .08;
    const y = .16 + flower * .035;
    m.tube([[fx, .06, fz], [fx + .012, y, fz]], .008, mat.moss, 0, 'Forest flower thin stems', 5);
    for (let petal = 0; petal < 5; petal++) {
      const a = petal / 5 * TAU;
      m.sphere([fx + Math.cos(a) * .029, y, fz + Math.sin(a) * .029], [.026, .012, .024],
        patch % 2 ? mat.ivory : mat.coral, 0, 'Forest ivory and coral five-petal flowers', 3, 6);
    }
    m.sphere([fx, y + .01, fz], [.018, .012, .018], mat.gold, 0, 'Forest warm gold flower pollen', 3, 6);
  }
});
for (const [x, z, scale] of [[-1.61, -.67, .9], [1.16, 1.28, .8], [-.37, -1.5, .75], [1.54, -.1, 1]]) {
  m.tapered([x, .10 * scale, z], .19 * scale, .025 * scale, .02 * scale, mat.ivory, 'Tiny mushroom stems', 8);
  canopy([x, .19 * scale, z], [.105 * scale, .05 * scale, .095 * scale], mat.coral, x * 2);
  for (const [dx, dz] of [[0, 0], [.036, .023], [-.034, .024]]) m.sphere([x + dx * scale, .232 * scale, z + dz * scale],
    [.017 * scale, .005 * scale, .015 * scale], mat.ivory, 0, 'Raised ivory mushroom cap spots', 3, 5);
}

// Crescent bank reeds and one hanging fern soften the cliff edge.
for (let index = 0; index < 6; index++) {
  const x = -.99 + index * .028, z = -.24 - index % 2 * .07;
  m.tube([[x, .035, z], [x + .025, .13 + index % 3 * .025, z], [x + .043, .17 + index % 3 * .02, z - .015]],
    [.007, .006, .001], mat.moss, 0, 'Pond reeds bending with growth', 5);
}
for (let index = 0; index < 5; index++) leaf([1.67 - index * .024, -.13 - index * .08, .88], .16, .035, index * .3, mat.moss);

const report = m.finish();
const after = hashes();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Generating Memory must preserve the existing Fox and Math assets.');
if (report.triangles > 35000 || report.bytes > 2 * 1024 * 1024) throw new Error(`Memory candidate exceeds budget: ${JSON.stringify(report)}`);
if (report.bounds[0][0] < -2.1 || report.bounds[1][0] > 2.1 || report.bounds[0][2] < -2.1
  || report.bounds[1][2] > 2.1 || report.bounds[0][1] < -1.5 || report.bounds[1][1] > 3) throw new Error(`Memory candidate exceeds world bounds: ${JSON.stringify(report.bounds)}`);
const document = { generator: 'tools/generate_v37_memory_asset.mjs', status: 'PR03 authored candidate; visual approval pending',
  provenance: m.gltf.asset.extras, asset: report, materials: m.gltf.materials.length,
  materialNames: m.gltf.materials.map(item => item.name), embeddedTextureFamilies: [...m.maps.keys()],
  foxLanding: { position: [-.95, .04, 1.25], clearRadius: .45, groundY: 0 },
  preservedAssetHashes: after, checks: { budgetsPass: true, boundsPass: true, selfContained: true, existingAssetsUnchanged: true,
    pbrChannelsOnEveryMaterial: m.gltf.materials.every(item => item.normalTexture && item.pbrMetallicRoughness.baseColorTexture
      && item.pbrMetallicRoughness.metallicRoughnessTexture),
    attributesFinite: [...m.groups.values()].every(group => [...group.p, ...group.n, ...group.uv].every(Number.isFinite)),
    uvPairsMatchVertices: [...m.groups.values()].every(group => group.uv.length / 2 === group.p.length / 3),
    indicesInBounds: [...m.groups.values()].every(group => group.idx.every(index => index >= 0 && index < group.p.length / 3)) } };
const reportPath = path.join(ROOT, 'docs/V37_art_qa/memory-asset-report.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(document, null, 2) + '\n');
console.log(JSON.stringify(document, null, 2));
