import { BoxGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh,
  Mesh, MeshStandardMaterial, Object3D, SphereGeometry, type BufferGeometry, type Material } from 'three';
import type { WorldId } from '../engine';

type Placement = { x: number; y: number; z: number; sx: number; sy: number; sz: number; turn?: number };

function batch(geometry: BufferGeometry, material: Material, placements: Placement[], shadows = true) {
  const mesh = new InstancedMesh(geometry, material, placements.length);
  const transform = new Object3D();
  placements.forEach((item, index) => {
    transform.position.set(item.x, item.y, item.z);
    transform.scale.set(item.sx, item.sy, item.sz);
    transform.rotation.set(0, item.turn ?? 0, 0);
    transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.castShadow = shadows; mesh.receiveShadow = true;
  mesh.userData.noShadow = !shadows;
  return mesh;
}

const grassColors: Record<WorldId, number> = {
  'math-quest': 0xb5cbb1, 'memory-match': 0xa6c7b0, 'sentence-builder': 0xd1c6a9,
};

/** Reusable interiors: a continuous foreground, paths, edge landmarks and distant hills. */
export function buildGameEnvironments() {
  const root = new Group(); root.name = 'Learning island interiors'; root.visible = false;
  const scenery = new Map<WorldId, Group>();
  const optionalDetails: Group[] = [];
  const box = new BoxGeometry(1, 1, 1);
  const leaf = new SphereGeometry(1, 10, 7);
  const trunk = new CylinderGeometry(.12, .2, 1, 7);
  const stone = new IcosahedronGeometry(1, 0);
  const disk = new CylinderGeometry(1, 1, .12, 12);
  const cream = new MeshStandardMaterial({ color: 0xf0dfbb, roughness: .96 });
  const wood = new MeshStandardMaterial({ color: 0xad8060, roughness: .95 });
  const teal = new MeshStandardMaterial({ color: 0x548b87, roughness: .88 });
  const green = new MeshStandardMaterial({ color: 0x659c81, roughness: .96 });
  const hillMaterial = new MeshStandardMaterial({ color: 0xa6c2b0, roughness: 1 });
  const grass = new MeshStandardMaterial({ color: grassColors['math-quest'], roughness: 1 });
  const edge = new MeshStandardMaterial({ color: 0xafa793, roughness: 1 });
  const foundation = new Mesh(new CylinderGeometry(18, 19, .9, 36), edge);
  foundation.position.set(0, -.7, -3); foundation.receiveShadow = true; root.add(foundation);
  const lawn = new Mesh(new CylinderGeometry(18, 18, .15, 36), grass);
  lawn.position.set(0, -.17, -3); lawn.receiveShadow = true; root.add(lawn);
  const hills = [-18, -10, -2, 7, 16].map((x, index) => ({ x, y: .2, z: -21 - index % 2 * 4,
    sx: 8 + index % 3, sy: 3.7 + index % 2 * 1.2, sz: 5.5, turn: index * .2 }));
  root.add(batch(leaf, hillMaterial, hills, false));

  for (const id of Object.keys(grassColors) as WorldId[]) {
    const group = new Group(); group.name = `${id} scenic interior`; group.visible = false;
    const detail = new Group(); detail.name = `${id} small accents`; optionalDetails.push(detail);
    const trunks: Placement[] = [], crowns: Placement[] = [];
    const positions = id === 'memory-match'
      ? [[-17, 4], [-17, -4], [-17, -15], [-4.5, -17], [9.3, 2.3], [11, -3], [10.5, -9], [3.9, -16]]
      : [[-17, 2.5], [-17.5, -6], [-4.5, -16], [10, .5], [12, -7]];
    positions.forEach(([x, z], index) => {
      const height = (id === 'memory-match' ? 3.6 : 2.7) + index % 3 * .45;
      trunks.push({ x, y: height * .45, z, sx: 1.2, sy: height, sz: 1.2 });
      for (let tier = 0; tier < 3; tier++) crowns.push({ x: x + Math.sin(index + tier) * .35,
        y: height * .75 + tier * .65, z: z + Math.cos(index + tier) * .25,
        sx: 1.6 - tier * .28, sy: 1.25 - tier * .17, sz: 1.5 - tier * .2 });
    });
    group.add(batch(trunk, wood, trunks), batch(leaf, green, crowns));
    const path = Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      return { x: -6 + t * 12 + Math.sin(t * Math.PI) * 1.8,
        y: -.035, z: 8 - t * 19, sx: .85 + index % 2 * .15, sy: 1, sz: .56, turn: t * 1.7 };
    });
    group.add(batch(disk, cream, path, false));
    detail.add(batch(stone, edge, Array.from({ length: 11 }, (_, index) => ({
      x: (index % 2 ? -1 : 1) * (8.3 + index % 3), y: .12, z: 5 - index * 1.7,
      sx: .3 + index % 3 * .11, sy: .25 + index % 2 * .13, sz: .27, turn: index,
    }))));

    if (id === 'math-quest') {
      group.add(batch(box, teal, [{ x: -8, y: .58, z: 4, sx: .95, sy: .95, sz: .95 },
        { x: -6.7, y: .4, z: 4.7, sx: .7, sy: .7, sz: .7 },
        { x: 10, y: .48, z: 4.2, sx: .8, sy: .8, sz: .8 }]));
      detail.add(batch(disk, cream, [{ x: -8, y: 1.1, z: 4, sx: .55, sy: 1, sz: .55 },
        { x: 10, y: .93, z: 4.2, sx: .5, sy: 1, sz: .5 }]));
    } else if (id === 'memory-match') {
      group.add(batch(box, cream, [{ x: 8.8, y: .18, z: 5, sx: 2.4, sy: .22, sz: .45 },
        { x: 8.1, y: -.01, z: 5, sx: .24, sy: .45, sz: .4 },
        { x: 9.5, y: -.01, z: 5, sx: .24, sy: .45, sz: .4 }]));
      detail.add(batch(leaf, teal, [{ x: -7.6, y: .17, z: 6, sx: .35, sy: .3, sz: .35 },
        { x: 11.3, y: .18, z: 3, sx: .45, sy: .35, sz: .42 }]));
    } else {
      const books: Placement[] = [];
      for (const [x, z] of [[-8, 4.8], [9, 3.4]]) {
        for (let index = 0; index < 4; index++) books.push({ x: x + Math.sin(index) * .12,
          y: .17 + index * .22, z, sx: 1.35 - index * .09, sy: .15, sz: .9, turn: index * .14 });
      }
      group.add(batch(box, teal, books));
      detail.add(batch(box, cream, books.map(item => ({ ...item, y: item.y + .09, sy: .055, sx: item.sx * .9 }))));
      group.add(batch(box, wood, [{ x: -7.8, y: 1.12, z: -1, sx: 2.7, sy: .16, sz: 1.15 },
        { x: -8.8, y: .5, z: -1, sx: .15, sy: 1.15, sz: .8 },
        { x: -6.8, y: .5, z: -1, sx: .15, sy: 1.15, sz: .8 }]));
    }
    group.add(detail); root.add(group); scenery.set(id, group);
  }
  return {
    root,
    setWorld(id: WorldId | null) {
      root.visible = id !== null;
      for (const [key, group] of scenery) group.visible = key === id;
      if (id) grass.color.setHex(grassColors[id]);
    },
    setQuality(high: boolean) { optionalDetails.forEach(group => { group.visible = high; }); },
  };
}
