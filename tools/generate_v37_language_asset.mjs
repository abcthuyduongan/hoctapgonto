/**
 * Original PR03 Language Island candidate. No external meshes, images or fonts.
 * Reproduce: node tools/generate_v37_language_asset.mjs
 * Shared Model import has a direct-run guard and never regenerates fox or Math.
 * Y-up, grass Y=0, +Z is the workshop front; fox landing [.95,.04,1.05].
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Model, TAU, add, sub, mul, cross, norm, png } from './generate_v37_slice_assets.mjs';

const originalAssets = ['fox-guide.glb', 'math-world.glb'];
const preserved = Object.fromEntries(originalAssets.map(file => [file,
  createHash('sha256').update(fs.readFileSync(new URL(`../public/models/${file}`, import.meta.url))).digest('hex')]));

class LanguageModel extends Model {
  /** Paper fibres and overlapping glazed tile relief are authored periodic maps. */
  texture(kind) {
    if (kind !== 'paper' && kind !== 'glaze') return super.texture(kind);
    if (this.maps.has(kind)) return this.maps.get(kind);
    const size = 256;
    const height = (x, y) => {
      const u = x / size * TAU, v = y / size * TAU;
      if (kind === 'paper') return .52 + .013 * Math.sin(u * 29 + Math.sin(v * 13))
        + .016 * Math.cos(v * 41 + u * 3) + .008 * Math.sin(u * 67) * Math.cos(v * 71);
      const row = Math.floor(y / 32), seam = y % 32 < 2 || (x + row % 2 * 16) % 32 < 2;
      return seam ? .34 : .58 + .025 * Math.sin(u * 16) * Math.cos(v * 16);
    };
    const maps = {
      base: png(size, size, (x, y) => {
        const n = kind === 'paper' ? 200 + height(x, y) * 90 : 213 + height(x, y) * 62;
        return [n, n, n, 255];
      }),
      normal: png(size, size, (x, y) => {
        const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y);
        const dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
        return [...norm([-dx * 1.1, -dy * 1.1, 1]).map(v => (v * .5 + .5) * 255), 255];
      }),
      rough: png(size, size, (x, y) => [255, (kind === 'paper' ? 202 : 102) + height(x, y) * 38, 0, 255]),
    };
    const ids = {};
    for (const [role, data] of Object.entries(maps)) {
      const image = this.gltf.images.length;
      this.gltf.images.push({ name: `${kind}_${role}_256`, mimeType: 'image/png', bufferView: this.bytes(data) });
      ids[role] = this.gltf.textures.length;
      this.gltf.textures.push({ name: `${kind}_${role}`, source: image, sampler: 0 });
    }
    this.maps.set(kind, ids); return ids;
  }
}

const m = new LanguageModel('language-world');
m.gltf.asset.generator = 'Bao An original Language Island generator V3.7 PR03';
m.gltf.asset.extras = {
  provenance: 'ORIGINAL_PROCEDURAL_V37_PR03', source: 'tools/generate_v37_language_asset.mjs',
  acceptance: 'candidate-not-art-approved', externalAssets: [],
  landmark: 'Xưởng Ngôn Từ', landing: [.95, .04, 1.05],
};
const materials = {
  masonry: m.material('Warm cream library masonry', 'EBCDA5', 'stone', .82),
  limestone: m.material('Ivory bevelled plinth paths and carved frames', 'F5E6CC', 'stone', .8),
  cliff: m.material('Warm weathered sandstone cliff', 'A87954', 'rock', .92),
  cliffShade: m.material('Deep layered ochre cliff strata', '76563F', 'rock', .94),
  cliffLight: m.material('Sunlit pale cliff shelves', 'BA9469', 'rock', .92),
  grass: m.material('Soft meadow grass and rim moss', '81BB84', 'grass', .93),
  foliage: m.material('Sculpted jade canopy and garden leaves', '3C896D', 'grass', .86),
  fresh: m.material('Sunlit sage leaf tips', 'B1CA8C', 'grass', .85),
  wood: m.material('Walnut door planks shelves and quill desk', '805E45', 'wood', .83),
  dark: m.material('Deep door window and shelf recess', '2C4148', 'wood', .88),
  roof: m.material('Individually glazed teal roof panels', '4D99A0', 'glaze', .58),
  roofEdge: m.material('Dark teal eaves and ridge caps', '2C707A', 'glaze', .59),
  paper: m.material('Warm ivory sculpted book paper', 'FFF6DF', 'paper', .86),
  lavender: m.material('Dusty lavender book covers and blossoms', '9B88B1', 'fabric', .76),
  brass: m.material('Muted honey brass letters and joinery', 'DFB669', 'satin', .51),
  glass: m.material('Soft turquoise glazing and inkpot', 'AACBCD', 'satin', .37),
};
const M = materials;

function face(points, material, name, uv) {
  const mesh = m.mesh(material, name), base = mesh.p.length / 3;
  const normal = norm(cross(sub(points[1], points[0]), sub(points[2], points[0])));
  points.forEach((p, i) => m.vertex(mesh, p, normal, uv?.[i] ?? [i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0]));
  for (let i = 1; i < points.length - 1; i++) mesh.idx.push(base, base + i, base + i + 1);
}
function rotatedBox(center, size, bevel, material, angle, axis = 'z', name = 'Hand fitted joinery', grid = 2) {
  const mesh = m.mesh(material, name), start = mesh.p.length;
  m.box([0, 0, 0], size, bevel, material, 0, name, grid);
  const rotate = p => {
    const c = Math.cos(angle), s = Math.sin(angle);
    if (axis === 'y') return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    if (axis === 'x') return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  };
  for (let i = start; i < mesh.p.length; i += 3) {
    mesh.p.splice(i, 3, ...add(center, rotate(mesh.p.slice(i, i + 3))));
    mesh.n.splice(i, 3, ...rotate(mesh.n.slice(i, i + 3)));
  }
}
const box = (center, size, material, bevel = .02, name = 'Bevelled stone and timber detailing', grid = 2) =>
  m.box(center, size, bevel, material, 0, name, grid);
const tube = (points, radii, material, name, sides = 8) => m.tube(points, radii, material, 0, name, sides);
const sphere = (center, radii, material, name, rings = 7, sides = 11, tilt = 0) =>
  m.sphere(center, radii, material, 0, name, rings, sides, tilt);

function cliffPoint(angle, radius, y, ring) {
  const shape = 1 + .026 * Math.sin(angle * 5 + .6) + .014 * Math.cos(angle * 9);
  return [Math.cos(angle) * radius * shape, y + (ring ? .015 * Math.sin(angle * 7 + ring) : 0), Math.sin(angle) * radius * shape];
}
const cliffRings = [[2.015, -.045], [2.01, -.21], [1.82, -.45], [1.64, -.72], [1.24, -1.01], [.77, -1.29], [.26, -1.47]];
const strata = [M.cliffLight, M.cliff, M.cliffLight, M.cliff, M.cliffShade, M.cliffShade];
for (let ring = 0; ring < cliffRings.length - 1; ring++) for (let i = 0; i < 40; i++) {
  const a = i / 40 * TAU, b = (i + 1) / 40 * TAU;
  face([cliffPoint(a, ...cliffRings[ring], ring), cliffPoint(b, ...cliffRings[ring], ring),
    cliffPoint(b, ...cliffRings[ring + 1], ring + 1), cliffPoint(a, ...cliffRings[ring + 1], ring + 1)], strata[ring], 'Layered organic floating library sandstone');
}
for (let i = 0; i < 40; i++) {
  const a = i / 40 * TAU, b = (i + 1) / 40 * TAU;
  face([[0, .006, 0], cliffPoint(b, 2.015, .006, 0), cliffPoint(a, 2.015, .006, 0)], M.grass, 'Soft island meadow crown');
  face([cliffPoint(a, 2.015, .006, 0), cliffPoint(b, 2.015, .006, 0), cliffPoint(b, 2.015, -.045, 0), cliffPoint(a, 2.015, -.045, 0)], M.grass, 'Thick moss meadow lip');
  face([[0, -1.493, 0], cliffPoint(a, .26, -1.47, 6), cliffPoint(b, .26, -1.47, 6)], M.cliffShade, 'Closed floating cliff underside');
}
for (let i = 0; i < 14; i++) {
  const a = i / 14 * TAU + .15;
  rotatedBox([Math.cos(a) * 1.73, -.43 - .06 * (i % 3), Math.sin(a) * 1.73],
    [.26 + .03 * (i % 3), .26, .25], .055, i % 3 ? M.cliff : M.cliffLight, a, 'y', 'Individual cliff outcrops', 2);
}
function tuft(x, z, height, rotation) {
  for (let j = -1; j <= 1; j++) {
    const angle = rotation + j * .5, dx = Math.cos(angle) * .025, dz = Math.sin(angle) * .025;
    const points = [[x - dx, .014, z - dz], [x + dx, .014, z + dz], [x + Math.cos(angle) * height * .3, height, z + Math.sin(angle) * height * .3]];
    face(points, j ? M.grass : M.fresh, 'Grouped hand sculpted meadow blades', [[0, 0], [1, 0], [.5, 1]]);
    face([...points].reverse(), j ? M.grass : M.fresh, 'Grouped hand sculpted meadow blades', [[.5, 1], [1, 0], [0, 0]]);
  }
}
for (let i = 0; i < 34; i++) {
  const a = i / 34 * TAU, radius = 1.92;
  tuft(Math.cos(a) * radius, Math.sin(a) * radius, .07 + i % 3 * .015, a);
  if (i % 3 === 0) sphere([Math.cos(a) * 1.967, -.005, Math.sin(a) * 1.967], [.115, .045, .10], M.grass, 'Meadow rim moss scallops', 5, 8);
}

// Broad ivory foundation, visible individual corners, and a layered cream brick façade.
const cx = -.12, cz = -.65;
box([cx, .052, cz], [1.9, .11, 1.42], M.limestone, .04, 'Library low limestone plinth', 3);
box([cx, .16, cz], [1.74, .2, 1.29], M.masonry, .04, 'Library bevelled lower foundation', 3);
box([cx, 1.03, cz], [1.67, 1.57, 1.19], M.masonry, .07, 'Warm cream main library walls', 4);
for (const y of [.33, .91, 1.49, 1.81]) box([cx, y, cz], [1.76, .046, 1.28], M.limestone, .012, 'Carved horizontal library stone courses', 2);
for (const x of [cx - .795, cx + .795]) for (const y of [.48, .76, 1.05, 1.34, 1.63]) {
  for (const z of [cz - .58, cz + .60]) box([x, y, z], [.115, .12, .10], M.limestone, .02, 'Raised alternating cream corner quoins', 2);
}
// Front and back gables have a sculpted solid triangular silhouette.
const eaveY = 1.835, ridgeY = 2.61, roofHalf = 1.04, roofFront = .09, roofBack = -1.45;
for (const [z, outward] of [[cz + .595, 1], [cz - .595, -1]]) {
  const points = [[cx - .835, eaveY, z], [cx + .835, eaveY, z], [cx, 2.47, z]];
  face(outward > 0 ? points : [...points].reverse(), M.masonry, 'Cream pointed library gable faces', [[0, 0], [1, 0], [.5, 1]]);
}
// Two sloping glazed planes, six visible tile rows, capped ridge and walnut eaves.
const slopeAngle = Math.atan((ridgeY - eaveY) / roofHalf);
for (const side of [-1, 1]) {
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const t = (row + .5) / 6, x = cx + side * roofHalf * t;
    const y = ridgeY - (ridgeY - eaveY) * t;
    const z = roofBack + (col + .5) * (roofFront - roofBack) / 7;
    rotatedBox([x, y, z], [.212, .052, .212], .016, row % 3 === 0 ? M.roofEdge : M.roof,
      -side * slopeAngle, 'z', 'Individually overlapping glazed roof panels', 2);
  }
  tube([[cx + side * roofHalf, eaveY - .04, roofBack - .015], [cx + side * roofHalf, eaveY - .04, roofFront + .03]], .044, M.wood, 'Walnut roof eave beams', 9);
  for (const z of [roofBack - .025, roofFront + .025]) tube([[cx + side * roofHalf, eaveY, z], [cx, ridgeY + .028, z]], .036, M.roofEdge, 'Curved dark teal gable bargeboards', 9);
}
for (let i = 0; i < 8; i++) tube([[cx, ridgeY + .024, roofBack + i * .193],
  [cx, ridgeY + .024, roofBack + .20 + i * .193]], .055, M.roofEdge, 'Separate longitudinal glazed ridge cap segments', 10);
// Closed stone chimney with a dark flue and a recessed ivory crown.
box([cx - .51, 2.475, -1.08], [.24, .65, .27], M.masonry, .025, 'Cream bookshop chimney', 2);
for (const y of [2.27, 2.48, 2.68]) box([cx - .51, y, -1.08], [.25, .025, .28], M.limestone, .007, 'Chimney stone joint courses', 2);
box([cx - .51, 2.816, -1.08], [.32, .09, .35], M.limestone, .02, 'Chimney projecting bevelled crown', 2);
box([cx - .51, 2.867, -1.08], [.16, .015, .19], M.dark, .004, 'Recessed chimney flue', 1);

function archedWindow(x, bottom, z, width, height, name = 'Library recessed mullioned windows') {
  m.arch(x, bottom - .025, z, width + .11, height + .09, .095, M.limestone);
  m.arch(x, bottom, z + .055, width, height, .035, M.dark);
  m.arch(x, bottom + .035, z + .081, width - .066, height - .066, .019, M.glass);
  tube([[x, bottom + .04, z + .10], [x, bottom + height - .04, z + .10]], .012, M.wood, `${name} vertical mullions`, 6);
  tube([[x - width * .36, bottom + height * .48, z + .10], [x + width * .36, bottom + height * .48, z + .10]], .011, M.wood, `${name} cross transoms`, 6);
  box([x, bottom - .025, z + .06], [width + .14, .058, .14], M.limestone, .016, 'Projecting library limestone window sill', 2);
}
const frontZ = cz + .62, doorX = cx - .39;
m.arch(doorX, .23, frontZ, .60, 1.0, .115, M.limestone);
m.arch(doorX, .267, frontZ + .065, .48, .885, .048, M.dark);
m.arch(doorX, .281, frontZ + .095, .434, .831, .032, M.wood);
for (const dx of [-.16, -.08, 0, .08, .16]) tube([[doorX + dx, .30, frontZ + .116], [doorX + dx, .90 - Math.abs(dx) * .38, frontZ + .116]], .005, M.dark, 'Carved separate walnut door boards', 5);
for (const y of [.41, .70]) box([doorX, y, frontZ + .126], [.392, .029, .017], M.brass, .006, 'Raised door brass cross straps', 2);
sphere([doorX + .11, .585, frontZ + .153], [.021, .021, .016], M.brass, 'Library door brass handle', 7, 9);
for (let i = 0; i <= 10; i++) {
  const a = i / 10 * Math.PI;
  rotatedBox([doorX + Math.cos(a) * .265, .918 + Math.sin(a) * .265, frontZ + .066], [.067, .082, .065], .013, M.masonry,
    a - Math.PI / 2, 'z', 'Individual arched doorway keystones', 2);
}
archedWindow(cx + .39, .54, frontZ - .017, .42, .70);
archedWindow(cx, 1.89, frontZ - .016, .22, .34, 'Upper gable reading room');
// A true dormer volume on the right roof slope with miniature roofing.
box([cx + .61, 2.11, -.62], [.41, .42, .47], M.masonry, .035, 'Recessed right roof dormer volume', 3);
archedWindow(cx + .61, 1.98, -.361, .21, .28, 'Dormer glazed windows');
for (const s of [-1, 1]) rotatedBox([cx + .61 + s * .12, 2.36, -.62], [.31, .048, .58], .011, M.roof,
  -s * .47, 'z', 'Two pitched dormer teal roof panels', 2);

// Front sign is a panel with raised hand-built Aa geometry, not generated typography.
box([cx - .06, 1.575, frontZ + .035], [.74, .25, .076], M.roofEdge, .025, 'Library teal carved letter sign', 3);
box([cx - .06, 1.575, frontZ + .08], [.68, .20, .024], M.wood, .016, 'Walnut sign inset', 2);
function letterAa(x, y, z, scale, material, name) {
  const stroke = coords => tube(coords.map(([px, py]) => [x + px * scale, y + py * scale, z]), .021 * scale, material, name, 9);
  stroke([[-.29, 0], [-.12, .45], [.055, 0]]); stroke([[-.23, .16], [-.008, .16]]);
  stroke([[.17, .07], [.115, .07], [.082, .14], [.092, .24], [.17, .29], [.238, .265], [.246, .17], [.21, .083], [.17, .07]]);
  stroke([[.245, .28], [.245, .07], [.292, .07]]);
}
letterAa(cx - .05, 1.494, frontZ + .101, .40, M.brass, 'Sculpted brass Aa library sign');

// Annex shelves remain legible from front-right and reverse carousel views.
box([1.11, .105, -.75], [.63, .19, .81], M.limestone, .038, 'Library side annex stone foundation', 3);
box([1.11, .65, -.80], [.58, .96, .69], M.masonry, .035, 'Cream open book alcove walls', 3);
box([1.11, .66, -.435], [.45, .77, .04], M.dark, .012, 'Book alcove deeply recessed interior', 2);
for (const y of [.28, .61, .97]) box([1.11, y, -.405], [.51, .045, .12], M.wood, .012, 'Three front walnut book shelf ledges', 2);
for (const x of [.86, 1.36]) box([x, .64, -.415], [.055, .81, .13], M.wood, .011, 'Bookcase vertical walnut stiles', 2);
for (const s of [-1, 1]) rotatedBox([1.11 + s * .18, 1.23, -.80], [.43, .055, .85], .012, M.roof,
  -s * .35, 'z', 'Side reading alcove pitched teal canopy', 2);
function book(center, size, cover, tilt = 0) {
  rotatedBox(center, size, .015, cover, tilt, 'z', 'Individual bevelled library book covers', 2);
  const mesh = m.mesh(M.paper, 'Exposed ivory book page blocks');
  rotatedBox(add(center, [0, 0, -.017]), [Math.max(.025, size[0] - .022), size[1] - .025, size[2] + .01], .008, M.paper, tilt, 'z', mesh.name, 2);
  for (const dy of [-.30, .30]) rotatedBox(add(center, [0, size[1] * dy, size[2] * .52]), [size[0] * .85, .012, .012], .003, M.brass, tilt, 'z', 'Raised brass book spine bands', 1);
}
for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) book([.935 + i * .087, .446 + row * .35, -.38],
  [.069, .22 + (i % 3) * .022, .112], [M.roof, M.lavender, M.wood, M.brass, M.roofEdge][i], i % 2 ? .07 : -.045);
// Small balcony below the main window; planters and rails cast real shadows.
box([cx + .40, .515, frontZ + .19], [.60, .06, .31], M.wood, .014, 'Front reading window walnut balcony floor', 2);
for (const x of [cx + .13, cx + .40, cx + .67]) {
  box([x, .68, frontZ + .327], [.032, .30, .031], M.wood, .008, 'Balcony turned walnut balusters', 2);
  sphere([x, .844, frontZ + .327], [.028, .022, .025], M.brass, 'Balcony brass post caps', 5, 8);
}
tube([[cx + .1, .82, frontZ + .327], [cx + .70, .82, frontZ + .327]], .025, M.wood, 'Balcony continuous rounded top rail', 7);

// Graduated entrance steps and individual path slabs. The fox landing remains clear.
for (let i = 0; i < 3; i++) box([doorX, .046 + i * .064, .23 - i * .09], [.65, .10, .25], M.limestone, .024, 'Library three entrance stone steps', 3);
for (let i = 0; i < 7; i++) {
  const t = i / 6, x = doorX + .14 * Math.sin(t * Math.PI), z = .47 + t * 1.22;
  rotatedBox([x, .028, z], [.43 - t * .04, .061, .15], .017, M.limestone,
    .10 * Math.sin(t * Math.PI), 'y', 'Curving individual pale meadow path stones', 2);
}
// A sculpted open-book landmark with layered curved paper surfaces.
const bookX = -1.18, bookZ = .69, bookY = .54;
m.tapered([bookX, .115, bookZ], .23, .35, .31, M.limestone, 'Open book monument carved stone pedestal', 28);
box([bookX, .305, bookZ], [.22, .30, .21], M.masonry, .045, 'Open book monument short bevelled support', 3);
for (const side of [-1, 1]) {
  rotatedBox([bookX + side * .245, bookY + .012, bookZ], [.54, .047, .66], .019, M.lavender,
    -side * .30, 'z', 'Separate lavender open book covers', 3);
  for (let layer = 0; layer < 5; layer++) {
    const thickness = layer * .012;
    for (let strip = 0; strip < 9; strip++) {
      const t0 = strip / 9, t1 = (strip + 1) / 9;
      const p = (t, z) => [bookX + side * (.018 + .49 * t), bookY + .064 + thickness + .115 * (1 - t) ** 2 + .025 * Math.sin(t * Math.PI), bookZ + z];
      const points = [p(t0, -.292), p(t0, .292), p(t1, .292), p(t1, -.292)];
      face(side > 0 ? points : [...points].reverse(), M.paper, 'Layered individually curved open book pages', [[t0, 0], [t0, 1], [t1, 1], [t1, 0]]);
    }
  }
  for (let line = 0; line < 5; line++) tube([0, .2, .45, .7, 1].map(t =>
    [bookX + side * (.09 + t * .33), bookY + .12 + .115 * (1 - (.15 + t * .65)) ** 2, bookZ - .18 + line * .08]), .005, M.brass, 'Quiet sculpted reading lines in open book', 5);
}
tube([[bookX, bookY + .19, bookZ - .31], [bookX, bookY + .205, bookZ], [bookX, bookY + .19, bookZ + .31]], .017, M.wood, 'Open book rounded central binding', 8);
// Front-facing raised letter sculpture makes the island identifiable at home scale.
letterAa(bookX + .01, .33, bookZ + .35, .95, M.brass, 'Freestanding golden Aa open book sculpture');

// A little quill writing table occupies the far-left, clear of the right landing.
const deskX = -1.50, deskZ = -.42;
box([deskX, .46, deskZ], [.58, .07, .49], M.wood, .025, 'Quill writing desk bevelled walnut top', 3);
for (const dx of [-.22, .22]) for (const dz of [-.17, .17]) tube([[deskX + dx, .025, deskZ + dz], [deskX + dx, .43, deskZ + dz]], [.024, .035], M.wood, 'Four tapered writing table legs', 8);
box([deskX + .11, .507, deskZ + .07], [.22, .012, .28], M.paper, .006, 'Quill desk blank paper sheet', 2);
m.tapered([deskX - .14, .556, deskZ - .03], .115, .064, .047, M.glass, 'Turquoise writing inkpot', 16);
m.tapered([deskX - .14, .616, deskZ - .03], .018, .048, .038, M.dark, 'Open dark inkpot neck', 16);
tube([[deskX - .14, .59, deskZ - .03], [deskX - .08, .76, deskZ - .015], [deskX + .02, .99, deskZ + .01]], .010, M.brass, 'Raised curved quill shaft', 7);
for (let i = 0; i < 7; i++) {
  const t = i / 6, y = .78 + t * .20, x = deskX - .074 + t * .087;
  sphere([x - .04 + .015 * t, y, deskZ + .006], [.065 * (1 - t * .5), .034, .015], M.paper, 'Individual ivory quill feather vanes', 5, 8, -.45);
  sphere([x + .022, y + .009, deskZ + .009], [.051 * (1 - t * .6), .026, .012], M.paper, 'Quill opposite fine feather vanes', 5, 8, .43);
}

function pottedPlant(x, z, scale = 1) {
  m.tapered([x, .105 * scale, z], .21 * scale, .083 * scale, .124 * scale, M.lavender, 'Lavender terracotta library garden pots', 14);
  m.tapered([x, .218 * scale, z], .033 * scale, .132 * scale, .132 * scale, M.limestone, 'Planter ivory rounded rim', 14);
  sphere([x, .229 * scale, z], [.107 * scale, .016 * scale, .107 * scale], M.dark, 'Recessed pot dark soil', 5, 9);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    tube([[x, .23 * scale, z], [x + Math.cos(a) * .055 * scale, .41 * scale, z + Math.sin(a) * .055 * scale]], .009 * scale, M.foliage, 'Potted plant slender stems', 5);
    sphere([x + Math.cos(a) * .073 * scale, .385 * scale, z + Math.sin(a) * .073 * scale], [.075 * scale, .12 * scale, .04 * scale], i % 2 ? M.foliage : M.fresh, 'Sculpted pointed potted plant leaves', 6, 9, -.3 * Math.cos(a));
  }
}
pottedPlant(cx + .09, .40, .75); pottedPlant(1.49, -.06, .85); pottedPlant(-.96, -.24, .7);
for (const [x, z, scale] of [[-1.26, -1.19, .77], [1.46, -.99, .64], [-1.15, 1.31, .48], [.53, -1.63, .5]]) {
  tube([[x, .018, z], [x + .025 * scale, .61 * scale, z]], [.043 * scale, .027 * scale], M.wood, 'Library garden sculpted tree trunks', 9);
  for (const [dx, dy, dz, radius] of [[0, .65, 0, .29], [-.16, .53, .06, .20], [.16, .55, -.07, .21]])
    sphere([x + dx * scale, dy * scale, z + dz * scale], [radius * scale, radius * 1.08 * scale, radius * scale], M.foliage, 'Three layered sculpted garden tree canopies', 9, 14);
  sphere([x - .04 * scale, .79 * scale, z + .07 * scale], [.17 * scale, .115 * scale, .18 * scale], M.fresh, 'Sunlit garden tree crowns', 7, 11);
}
const landing = [.95, .04, 1.05];
const groundPatches = [[-1.6, .25], [-.10, 1.56], [.35, 1.66], [1.48, .42], [1.61, -.50], [-.71, -1.55], [-1.51, -1.0], [.52, .33]];
for (const [index, [x, z]] of groundPatches.entries()) {
  sphere([x, .037, z], [.18, .06, .15], M.foliage, 'Small library garden ground-cover patches', 5, 8);
  sphere([x + .07, .064, z - .02], [.115, .059, .09], M.fresh, 'Ground cover soft sunlit sage layers', 5, 8);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + index;
    tuft(x + Math.cos(a) * .12, z + Math.sin(a) * .12, .085 + i % 2 * .02, a);
  }
  for (let petal = 0; petal < 5; petal++) {
    const a = petal / 5 * TAU;
    sphere([x + Math.cos(a) * .031, .142, z + Math.sin(a) * .031], [.026, .013, .024], M.lavender, 'Five petal lavender library blossoms', 4, 7);
  }
  sphere([x, .153, z], [.018, .012, .018], M.brass, 'Warm gold blossom centers', 4, 7);
}

// Model.finish writes a self-contained GLB. Rewrite its PR02-only scene marker first.
const sharedFinish = m.finish.bind(m);
const stats = sharedFinish();
const assetPath = new URL('../public/models/language-world.glb', import.meta.url);
const glb = fs.readFileSync(assetPath), jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
gltf.scenes[0].extras = {
  groundY: 0, artStatus: 'PR03 candidate; requires visual approval', triangleCount: stats.triangles,
  landing, landingClearRadius: .46, features: ['Layered organic cliff', 'Panelled teal roof', 'Recessed arched windows',
    'Walnut door plank joinery', 'Bookcase with individual books', 'Curved open-book page layers', 'Sculpted Aa letters', 'Quill writing desk'],
};
const json = Buffer.from(JSON.stringify(gltf)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
const binChunk = glb.subarray(20 + jsonLength);
const header = Buffer.from(glb.subarray(0, 12)); header.writeUInt32LE(12 + 8 + padded.length + binChunk.length, 8);
const chunkHeader = Buffer.alloc(8); chunkHeader.writeUInt32LE(padded.length); chunkHeader.writeUInt32LE(0x4e4f534a, 4);
const finalGlb = Buffer.concat([header, chunkHeader, padded, binChunk]); fs.writeFileSync(assetPath, finalGlb);
stats.bytes = finalGlb.length; stats.sha256 = createHash('sha256').update(finalGlb).digest('hex');
const unchangedAssets = Object.fromEntries(originalAssets.map(file => [file,
  createHash('sha256').update(fs.readFileSync(new URL(`../public/models/${file}`, import.meta.url))).digest('hex') === preserved[file]]));
let minRaisedVertexDistanceFromLanding = Infinity;
for (const mesh of m.groups.values()) for (let i = 0; i < mesh.p.length; i += 3) {
  if (mesh.p[i + 1] > .05 && mesh.p[i + 1] < 1.8) minRaisedVertexDistanceFromLanding = Math.min(
    minRaisedVertexDistanceFromLanding, Math.hypot(mesh.p[i] - landing[0], mesh.p[i + 2] - landing[2]));
}
if (stats.triangles > 35000 || stats.bytes > 2 * 1024 * 1024) throw new Error('Language Island exceeds its PR03 candidate budget.');
if (stats.meshes > 16 || !Object.values(unchangedAssets).every(Boolean)) throw new Error('Material batching or original asset preservation check failed.');
const report = {
  generator: 'tools/generate_v37_language_asset.mjs', status: 'PR03 authored candidate, pending art approval',
  provenance: gltf.asset.extras, assets: [stats], budgets: { triangles: 35000, bytes: 2 * 1024 * 1024, materials: 16 },
  materialNames: gltf.materials.map(material => material.name), textureKinds: [...m.maps.keys()],
  embeddedPbr: { baseColorMaps: gltf.materials.length, normalMaps: gltf.materials.length, roughnessMaps: gltf.materials.length,
    externalUris: gltf.images.filter(image => image.uri).length },
  geometryFeatures: gltf.scenes[0].extras.features, landing, landingClearRadius: .46, unchangedAssets,
  validation: { budgetPass: true, selfContained: true, minRaisedVertexDistanceFromLanding: +minRaisedVertexDistanceFromLanding.toFixed(3) },
  palette: { cream: '#EBCDA5', teal: '#4D99A0', sage: '#81BB84', walnut: '#805E45', brass: '#DFB669', lavender: '#9B88B1' },
  notes: ['Geometry, maps and glyph strokes authored in this generator; no external art or fonts.',
    'Asset approval requires application visual QA and real device performance checks.'],
};
fs.mkdirSync(new URL('../docs/V37_art_qa/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../docs/V37_art_qa/language-asset-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
