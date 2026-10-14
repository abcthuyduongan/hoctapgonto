/** Project-authored shared backdrop: textured distant land, falling water and cloud banks. */
import fs from 'node:fs';
import { Model, TAU, add, sub, cross, norm, png } from './generate_v37_slice_assets.mjs';

const m = new Model('environment');
m.gltf.asset.generator = 'Bao An original shared environment V3.7 PR03';
m.gltf.asset.extras = { provenance: 'ORIGINAL_PROCEDURAL_V37_PR03', source: 'tools/generate_v37_environment_asset.mjs',
  acceptance: 'candidate-not-art-approved', externalAssets: [] };
const rock = m.material('Distant cool sandstone', '91AAA4', 'rock', .98);
const shadow = m.material('Distant stratified deep rock', '76948F', 'rock', 1);
const meadow = m.material('Muted moss ledges', 'A7C1AE', 'grass', 1);
const cloud = m.material('Porcelain cloud banks', 'FFF8E7', 'satin', 1);
m.gltf.materials[cloud].extras = { baoAnRole: 'cloud' };
const water = m.material('Turquoise waterfall ribbons', '9FD5CF', 'satin', .42);
const foam = m.material('Pale waterfall foam', 'E8F4E9', 'satin', .8);
for (const [mat, alpha] of [[cloud, .82], [water, .72], [foam, .66]]) {
  m.gltf.materials[mat].alphaMode = 'BLEND';
  m.gltf.materials[mat].pbrMetallicRoughness.baseColorFactor[3] = alpha;
  m.gltf.materials[mat].doubleSided = true;
}
// Actual periodic water texture, normal and roughness; no remote image or painted backdrop.
const waterMaps = {
  base: png(256, 256, (x, y) => { const n = 226 + 22 * Math.sin(x / 256 * TAU * 7 + Math.sin(y / 256 * TAU * 2)); return [n, n, n, 255]; }),
  normal: png(256, 256, (x, y) => [128 + 12 * Math.sin(x / 256 * TAU * 7), 128 + 8 * Math.cos(y / 256 * TAU * 3), 252, 255]),
  rough: png(256, 256, (x, y) => [255, 166 + 32 * Math.sin(x / 256 * TAU * 5 + y / 256 * TAU * 2), 0, 255]),
};
const maps = {};
for (const [role, bytes] of Object.entries(waterMaps)) {
  const index = m.gltf.images.length;
  m.gltf.images.push({ name: `waterfall_${role}_256`, mimeType: 'image/png', bufferView: m.bytes(bytes) });
  maps[role] = m.gltf.textures.length; m.gltf.textures.push({ source: index, sampler: 0 });
}
m.gltf.materials[water].pbrMetallicRoughness.baseColorTexture.index = maps.base;
m.gltf.materials[water].pbrMetallicRoughness.metallicRoughnessTexture.index = maps.rough;
m.gltf.materials[water].normalTexture.index = maps.normal;

const face = (points, material, name) => {
  const mesh = m.mesh(material, name), base = mesh.p.length / 3;
  const normal = norm(cross(sub(points[1], points[0]), sub(points[2], points[0])));
  points.forEach((point, i) => m.vertex(mesh, point, normal, [[0, 0], [1, 0], [1, 1], [0, 1]][i]));
  for (let i = 1; i < points.length - 1; i++) mesh.idx.push(base, base + i, base + i + 1);
};
// Closed irregular islands produce visible volume and ledges rather than a mountain wall.
function distantIsland(cx, cy, cz, radius, height, seed) {
  const rings = [[1, 0], [.91, -.25], [.69, -.64], [.42, -1], [.12, -1.18]];
  const point = (i, layer) => {
    const angle = i / 24 * TAU;
    const [r, y] = rings[layer], shape = 1 + .07 * Math.sin(angle * 5 + seed) + .03 * Math.cos(angle * 9);
    return [cx + Math.cos(angle) * radius * r * shape, cy + y * height + .10 * Math.sin(angle * 3 + seed), cz + Math.sin(angle) * radius * r * shape];
  };
  for (let i = 0; i < 24; i++) {
    face([[cx, cy + .07, cz], point(i + 1, 0), point(i, 0)], meadow, 'Moss crown of distant floating islands');
    for (let layer = 0; layer < rings.length - 1; layer++) {
      face([point(i, layer), point(i + 1, layer), point(i + 1, layer + 1), point(i, layer + 1)], layer % 2 ? shadow : rock, 'Irregular closed rock strata of distant islands');
    }
    face([[cx, cy - height * 1.24, cz], point(i, 4), point(i + 1, 4)], shadow, 'Closed underside of distant rocks');
  }
  // Hand-shaped ground ridges: offset shoulders and uneven contours avoid a
  // spherical silhouette while retaining a quiet, low-detail distant layer.
  const hillX = cx - radius * .22, hillZ = cz - radius * .20;
  const crest = [hillX - radius * .10, cy + height * .36, hillZ - radius * .12];
  const ridge = (i, ring) => {
    const angle = i / 24 * TAU, t = ring / 6;
    const contour = 1 + .13 * Math.sin(angle * 3 + seed) + .05 * Math.cos(angle * 7 + t * 2);
    const rise = Math.pow(1 - t * t, 1.35) * height * .33;
    return [hillX + Math.cos(angle) * radius * .76 * t * contour - radius * .1 * (1 - t),
      cy + .1 + rise * (1 + .10 * t * Math.sin(angle * 3 + seed)),
      hillZ + Math.sin(angle) * radius * .65 * t * contour - radius * .12 * (1 - t)];
  };
  for (let i = 0; i < 24; i++) {
    face([crest, ridge(i + 1, 1), ridge(i, 1)], meadow, 'Uneven moss ridge crests');
    for (let ring = 1; ring < 6; ring++) face([ridge(i, ring), ridge(i + 1, ring), ridge(i + 1, ring + 1), ridge(i, ring + 1)],
      meadow, 'Asymmetric distant meadow shoulders');
  }
}
distantIsland(-15, -4.3, -18, 3.1, 4.8, .8);
distantIsland(15.5, -4.7, -21, 3.5, 5.2, 2.2);
distantIsland(-24, -7.2, -32, 6.8, 5.8, 1.4);
distantIsland(23, -7.6, -34, 7.2, 5.3, 2.7);

// Separate wavy water ribbons with a tiny thickness, foam veins and splash volumes.
for (const [cx, top, cz, fall] of [[-15.5, -4.1, -15.4, 5.4], [16, -4.5, -17.8, 5.7]]) {
  const strip = (side, t) => [cx + side * .48 + Math.sin(t * 8) * .08,
    top - fall * t, cz + t * .35 + .08 * Math.sin(t * TAU)];
  for (let i = 0; i < 20; i++) {
    const a = i / 20, b = (i + 1) / 20;
    face([strip(-1, a), strip(-1, b), strip(1, b), strip(1, a)], water, 'Flowing dimensional waterfall ribbons');
    face([add(strip(1, a), [0, 0, -.04]), add(strip(1, b), [0, 0, -.04]), strip(1, b), strip(1, a)], water, 'Waterfall ribbon edge thickness');
  }
  for (let strand = 0; strand < 4; strand++) {
    const points = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11; return [cx + (strand - 1.5) * .20 + Math.sin(t * 9 + strand) * .06, top - t * fall, cz + t * .35 + .045];
    });
    m.tube(points, .024 + strand % 2 * .013, foam, 0, 'Sculpted waterfall foam strands', 5);
  }
  for (let i = 0; i < 5; i++) m.sphere([cx + (i - 2) * .22, top - fall + .10 * Math.sin(i), cz + .38],
    [.30, .16 + i % 2 * .1, .27], foam, 0, 'Waterfall spray volumes', 5, 10);
}

// Warm volumetric cloud banks at near, middle and far depths.
for (const [bank, [cx, cy, cz, scale]] of [[-9, -2.4, -8, 1], [10, -2.8, -8.5, 1], [-18, -3.4, -21, 1.7],
  [18, -3.6, -22, 1.8], [-10, -3.4, 3.5, 1.05], [10.5, -3.5, 3, 1.1]].entries()) {
  for (let i = 0; i < 5; i++) m.sphere([cx + (i - 2) * .73 * scale, cy + Math.sin(i * 1.7) * .2 * scale, cz + Math.cos(i * 2.1) * .28 * scale],
    [(1 + i % 2 * .18) * scale, (.42 + i % 3 * .09) * scale, .70 * scale], cloud, 0, 'Soft sculpted porcelain cloud banks', 7, 14);
}
const report = m.finish();
fs.mkdirSync('docs/V37_art_qa', { recursive: true });
fs.writeFileSync('docs/V37_art_qa/environment-asset-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
