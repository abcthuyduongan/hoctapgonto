import { BoxGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh,
  Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3,
  type BufferGeometry, type Material } from 'three';
import type { WorldId } from '../engine';

type Placement = { x: number; y: number; z: number; sx: number; sy: number; sz: number;
  turn?: number; orientation?: Quaternion };
export type GameMaterialRole = 'lawn' | 'cliff' | 'path' | 'bark' | 'leaf' | 'leafLight' | 'accent' | 'paper' | 'wood' | 'bookCover';
export type GameWorldMaterialNames = Readonly<Record<GameMaterialRole, string>>;

/** Exact authored names; no substring or first-material guesses. */
export const GAME_WORLD_MATERIAL_NAMES: Readonly<Record<WorldId, GameWorldMaterialNames>> = {
  'math-quest': {
    lawn: 'Living mint grass', cliff: 'Warm stratified island rock', path: 'Pale paving and trim',
    bark: 'Walnut arched door', leaf: 'Deep jade leaves', leafLight: 'Fresh lime grass tips',
    accent: 'Turquoise glazed roof band', paper: 'Pale paving and trim', wood: 'Walnut arched door', bookCover: 'Glazed blue castle roofs',
  },
  'memory-match': {
    lawn: 'Forest grass and soft moss carpet', cliff: 'Forest weathered limestone cliff', path: 'Forest ivory memory tablets and petals',
    bark: 'Forest warm sculpted bark', leaf: 'Forest sage leaf canopies', leafLight: 'Forest sunlit lime leaf crowns',
    accent: 'Forest teal raised memory symbols', paper: 'Forest ivory memory tablets and petals', wood: 'Forest honey bridge planks', bookCover: 'Forest teal raised memory symbols',
  },
  'sentence-builder': {
    lawn: 'Soft meadow grass and rim moss', cliff: 'Warm weathered sandstone cliff', path: 'Ivory bevelled plinth paths and carved frames',
    bark: 'Walnut door planks shelves and quill desk', leaf: 'Sculpted jade canopy and garden leaves', leafLight: 'Sunlit sage leaf tips',
    accent: 'Individually glazed teal roof panels', paper: 'Warm ivory sculpted book paper', wood: 'Walnut door planks shelves and quill desk', bookCover: 'Dusty lavender book covers and blossoms',
  },
};
function batch(geometry: BufferGeometry, material: Material, placements: Placement[], shadows = true) {
  const mesh = new InstancedMesh(geometry, material, placements.length), transform = new Object3D();
  placements.forEach((item, index) => {
    transform.position.set(item.x, item.y, item.z); transform.scale.set(item.sx, item.sy, item.sz);
    if (item.orientation) transform.quaternion.copy(item.orientation); else transform.rotation.set(0, item.turn ?? 0, 0);
    transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.castShadow = shadows; mesh.receiveShadow = true; mesh.userData.noShadow = !shadows; return mesh;
}
function branch(from: readonly [number, number, number], to: readonly [number, number, number], width: number): Placement {
  const start = new Vector3(...from), end = new Vector3(...to), delta = end.clone().sub(start);
  const center = start.clone().add(end).multiplyScalar(.5);
  return { x: center.x, y: center.y, z: center.z, sx: width, sy: delta.length(), sz: width,
    orientation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()) };
}
function tileUvs(geometry: BufferGeometry, repeatU: number, repeatV: number) {
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index++) uv.setXY(index, uv.getX(index) * repeatU, uv.getY(index) * repeatV);
  uv.needsUpdate = true; return geometry;
}
const grassColors: Record<WorldId, number> = { 'math-quest': 0x70b67d, 'memory-match': 0x79b88c, 'sentence-builder': 0x81bb84 };

/** Lightweight interiors borrow decoded island PBR maps/materials without changing their owner. */
export function buildGameEnvironments() {
  const root = new Group(); root.name = 'Learning island interiors'; root.visible = false;
  const scenery = new Map<WorldId, Group>(), optionalDetails: Group[] = [];
  const bindings = new Map<WorldId, Map<GameMaterialRole, Mesh[]>>();
  const palettes = new Map<WorldId, Map<GameMaterialRole, Material>>();
  const ownedGeometry = new Set<BufferGeometry>(), ownedMaterials = new Set<Material>();
  const hillClones = new Map<WorldId, MeshStandardMaterial>();
  const ownGeometry = <T extends BufferGeometry>(geometry: T) => { ownedGeometry.add(geometry); return geometry; };
  const ownMaterial = (material: MeshStandardMaterial) => { ownedMaterials.add(material); return material; };
  const box = ownGeometry(new BoxGeometry(1, 1, 1)), leaf = ownGeometry(new SphereGeometry(1, 10, 7));
  const trunk = ownGeometry(new CylinderGeometry(.12, .2, 1, 7)), stone = ownGeometry(new IcosahedronGeometry(1, 0));
  const disk = ownGeometry(new CylinderGeometry(1, 1, .12, 12));
  const foundationGeometry = ownGeometry(tileUvs(new CylinderGeometry(18, 19, .9, 36), 12, 2));
  const lawnGeometry = ownGeometry(tileUvs(new CylinderGeometry(18, 18, .15, 36), 14, 14));
  const cream = ownMaterial(new MeshStandardMaterial({ color: 0xf0dfbb, roughness: .96 }));
  const wood = ownMaterial(new MeshStandardMaterial({ color: 0xad8060, roughness: .95 }));
  const teal = ownMaterial(new MeshStandardMaterial({ color: 0x548b87, roughness: .88 }));
  const green = ownMaterial(new MeshStandardMaterial({ color: 0x659c81, roughness: .96 }));
  const fresh = ownMaterial(new MeshStandardMaterial({ color: 0xacc78e, roughness: .96 }));
  const hillMaterial = ownMaterial(new MeshStandardMaterial({ color: 0xa6c2b0, roughness: 1 }));
  const edge = ownMaterial(new MeshStandardMaterial({ color: 0xafa793, roughness: 1 }));
  const defaultPalette: Record<GameMaterialRole, Material> = { lawn: green, cliff: edge, path: cream, bark: wood,
    leaf: green, leafLight: fresh, accent: teal, paper: cream, wood, bookCover: teal };
  for (const id of Object.keys(grassColors) as WorldId[]) {
    const lawn = ownMaterial(new MeshStandardMaterial({ color: grassColors[id], roughness: 1 }));
    palettes.set(id, new Map(Object.entries({ ...defaultPalette, lawn }) as [GameMaterialRole, Material][])); bindings.set(id, new Map());
  }
  const foundation = new Mesh<BufferGeometry, Material>(foundationGeometry, edge); foundation.name = 'PBR stratified interior foundation';
  foundation.position.set(0, -.7, -3); foundation.receiveShadow = true; root.add(foundation);
  const lawn = new Mesh<BufferGeometry, Material>(lawnGeometry, green); lawn.name = 'PBR continuous meadow foreground';
  lawn.position.set(0, -.17, -3); lawn.receiveShadow = true; root.add(lawn);
  const hills = batch(leaf, hillMaterial, [-18, -10, -2, 7, 16].map((x, index) => ({
    x, y: .2, z: -21 - index % 2 * 4, sx: 8 + index % 3, sy: 3.7 + index % 2 * 1.2, sz: 5.5, turn: index * .2,
  })), false); hills.name = 'Soft distant sage hills'; root.add(hills);
  const bind = <T extends Mesh>(id: WorldId, role: GameMaterialRole, mesh: T) => {
    const roles = bindings.get(id)!;
    if (!roles.has(role)) roles.set(role, []);
    roles.get(role)!.push(mesh); mesh.material = palettes.get(id)!.get(role)!; mesh.userData.gameMaterialRole = role; return mesh;
  };
  for (const id of Object.keys(grassColors) as WorldId[]) {
    const group = new Group(); group.name = `${id} scenic interior`; group.visible = false;
    const detail = new Group(); detail.name = `${id} small accents`; optionalDetails.push(detail);
    const timber: Placement[] = [], crowns: Placement[] = [], lightCrowns: Placement[] = [];
    const positions = id === 'memory-match' ? [[-17, 4], [-17, -4], [-17, -15], [-4.5, -17], [9.3, 2.3], [11, -3], [10.5, -9], [3.9, -16]]
      : [[-17, 2.5], [-17.5, -6], [-4.5, -16], [10, .5], [12, -7]];
    positions.forEach(([x, z], index) => {
      const height = (id === 'memory-match' ? 3.6 : 2.7) + index % 3 * .45;
      timber.push(branch([x, -.11, z], [x + .15, height * .78, z - .08], 1.25));
      // Tapering boughs and flared roots replace a pole-and-sphere silhouette.
      for (let limb = 0; limb < 3; limb++) {
        const angle = index * .8 + limb * Math.PI * 2 / 3;
        timber.push(branch([x + .05, height * .46, z], [x + Math.cos(angle) * .95, height * (.73 + limb * .045), z + Math.sin(angle) * .8], .60));
        timber.push(branch([x, .30, z], [x + Math.cos(angle) * .58, -.10, z + Math.sin(angle) * .47], .92));
      }
      for (let lobe = 0; lobe < 5; lobe++) {
        const angle = lobe / 5 * Math.PI * 2 + index * .4;
        crowns.push({ x: x + Math.cos(angle) * .66, y: height * .81 + Math.sin(lobe * 1.4) * .24,
          z: z + Math.sin(angle) * .57, sx: .99 + lobe % 2 * .15, sy: .95, sz: 1.05, turn: angle });
      }
      crowns.push({ x: x + .11, y: height * .91 + .45, z: z - .06, sx: 1.05, sy: .95, sz: 1.05, turn: index * .2 });
      lightCrowns.push({ x: x - .19, y: height * .94 + .78, z: z + .14, sx: .67, sy: .58, sz: .72, turn: index * .4 });
    });
    group.add(bind(id, 'bark', batch(trunk, wood, timber)), bind(id, 'leaf', batch(leaf, green, crowns)));
    detail.add(bind(id, 'leafLight', batch(leaf, fresh, lightCrowns, false)));
    const path = Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      return { x: -6 + t * 12 + Math.sin(t * Math.PI) * 1.8, y: -.035, z: 8 - t * 19,
        sx: .85 + index % 2 * .15, sy: 1, sz: .56, turn: t * 1.7 };
    });
    group.add(bind(id, 'path', batch(disk, cream, path, false)));
    detail.add(bind(id, 'cliff', batch(stone, edge, Array.from({ length: 11 }, (_, index) => ({
      x: (index % 2 ? -1 : 1) * (8.3 + index % 3), y: .12, z: 5 - index * 1.7,
      sx: .3 + index % 3 * .11, sy: .25 + index % 2 * .13, sz: .27, turn: index,
    })))));
    if (id === 'math-quest') {
      group.add(bind(id, 'accent', batch(box, teal, [{ x: -8, y: .58, z: 4, sx: .95, sy: .95, sz: .95 },
        { x: -6.7, y: .4, z: 4.7, sx: .7, sy: .7, sz: .7 }, { x: 10, y: .48, z: 4.2, sx: .8, sy: .8, sz: .8 }])));
      detail.add(bind(id, 'path', batch(disk, cream, [{ x: -8, y: 1.1, z: 4, sx: .55, sy: 1, sz: .55 },
        { x: 10, y: .93, z: 4.2, sx: .5, sy: 1, sz: .5 }])));
    } else if (id === 'memory-match') {
      group.add(bind(id, 'wood', batch(box, wood, [{ x: 8.8, y: .18, z: 5, sx: 2.4, sy: .22, sz: .45 },
        { x: 8.1, y: -.01, z: 5, sx: .24, sy: .45, sz: .4 }, { x: 9.5, y: -.01, z: 5, sx: .24, sy: .45, sz: .4 }])));
      detail.add(bind(id, 'accent', batch(leaf, teal, [{ x: -7.6, y: .17, z: 6, sx: .35, sy: .3, sz: .35 },
        { x: 11.3, y: .18, z: 3, sx: .45, sy: .35, sz: .42 }])));
    } else {
      const books: Placement[] = [];
      for (const [x, z] of [[-8, 4.8], [9, 3.4]]) for (let index = 0; index < 4; index++) books.push({
        x: x + Math.sin(index) * .12, y: .17 + index * .22, z, sx: 1.35 - index * .09, sy: .15, sz: .9, turn: index * .14 });
      group.add(bind(id, 'bookCover', batch(box, teal, books)));
      detail.add(bind(id, 'paper', batch(box, cream, books.map(item => ({ ...item, y: item.y + .09, sy: .055, sx: item.sx * .9 })))));
      group.add(bind(id, 'wood', batch(box, wood, [{ x: -7.8, y: 1.12, z: -1, sx: 2.7, sy: .16, sz: 1.15 },
        { x: -8.8, y: .5, z: -1, sx: .15, sy: 1.15, sz: .8 }, { x: -6.8, y: .5, z: -1, sx: .15, sy: 1.15, sz: .8 }])));
    }
    group.add(detail); root.add(group); scenery.set(id, group);
  }
  let currentWorld: WorldId | null = null, disposed = false;
  const applyPalette = (id: WorldId) => {
    const palette = palettes.get(id)!;
    for (const [role, meshes] of bindings.get(id)!) for (const mesh of meshes) mesh.material = palette.get(role)!;
    if (currentWorld === id) { lawn.material = palette.get('lawn')!; foundation.material = palette.get('cliff')!; hills.material = hillClones.get(id) ?? hillMaterial; }
  };
  return {
    root,
    applyWorldMaterials(id: WorldId, source: Object3D, names: GameWorldMaterialNames = GAME_WORLD_MATERIAL_NAMES[id]) {
      const found = new Map<string, Material>();
      source.traverse(node => { const mesh = node as Mesh; if (mesh.isMesh)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) found.set(material.name, material); });
      const resolved: GameMaterialRole[] = [], missing: { role: GameMaterialRole; name: string }[] = [];
      if (disposed) return { resolved, missing };
      const palette = palettes.get(id)!;
      for (const [role, name] of Object.entries(names) as [GameMaterialRole, string][]) {
        const material = found.get(name);
        if (material) { palette.set(role, material); resolved.push(role); } else missing.push({ role, name });
      }
      // Only distant hill tint needs a clone; keep all decoded texture references.
      const leafMaterial = palette.get('leaf') as MeshStandardMaterial;
      if (leafMaterial.isMeshStandardMaterial) {
        const previous = hillClones.get(id); if (previous) { ownedMaterials.delete(previous); previous.dispose(); }
        const hill = leafMaterial.clone(); hill.name = `${id} owned distant hill tint`;
        hill.color.lerp(hillMaterial.color, .64); hill.userData.gameInteriorOwnedTint = true;
        hillClones.set(id, hill); ownedMaterials.add(hill);
      }
      applyPalette(id); return { resolved, missing };
    },
    setWorld(id: WorldId | null) {
      if (disposed) return;
      currentWorld = id; root.visible = id !== null;
      for (const [key, group] of scenery) group.visible = key === id;
      if (id) applyPalette(id);
    },
    setQuality(high: boolean) { if (!disposed) optionalDetails.forEach(group => { group.visible = high; }); },
    /** Call before the owner's disposeScene; borrowed resources retain their owner. */
    dispose() {
      if (disposed) return; disposed = true;
      root.traverse(node => { if (node instanceof InstancedMesh) node.dispose(); }); root.removeFromParent(); root.clear();
      ownedGeometry.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(material => material.dispose());
      ownedGeometry.clear(); ownedMaterials.clear(); hillClones.clear(); palettes.clear(); bindings.clear(); scenery.clear(); optionalDetails.length = 0;
    },
  };
}
