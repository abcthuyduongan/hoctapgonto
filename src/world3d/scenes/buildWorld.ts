import { Scene, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry,
  ConeGeometry, BoxGeometry, HemisphereLight, DirectionalLight, Fog, BufferGeometry,
  Float32BufferAttribute, Color, IcosahedronGeometry, InstancedMesh, Object3D,
  TorusGeometry, type Material } from 'three';
import { WORLD_LAYOUT } from './worldLayout';
import type { WorldId } from '../engine';

type Placement = { x: number; y: number; z: number; sx: number; sy: number; sz: number; turn?: number };
function instances(geometry: BufferGeometry, material: Material, placements: Placement[], shadow = true) {
  const mesh = new InstancedMesh(geometry, material, placements.length);
  const transform = new Object3D();
  placements.forEach((item, index) => {
    transform.position.set(item.x, item.y, item.z);
    transform.scale.set(item.sx, item.sy, item.sz);
    transform.rotation.set(0, item.turn ?? 0, 0);
    transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.userData.noShadow = !shadow;
  mesh.castShadow = shadow; mesh.receiveShadow = shadow;
  return mesh;
}

/** Solid distant landforms: actual lit volume, with a muted atmospheric palette. */
function ridge(z: number, baseY: number, color: number, phase: number) {
  const positions: number[] = [], colors: number[] = [];
  const tint = new Color(color);
  const triangle = (a: number[], b: number[], c: number[], light: number) => {
    positions.push(...a, ...b, ...c);
    for (const point of [a, b, c]) {
      const baseFade = Math.max(0, Math.min(1, (point[1] - (baseY - 6)) / 8));
      const sideFade = Math.max(0, Math.min(1, (28 - Math.abs(point[0])) / 8));
      colors.push(tint.r * light, tint.g * light, tint.b * light, baseFade * sideFade);
    }
  };
  for (let i = 0; i < 14; i++) {
    const x = (i - 7) * 4;
    const height = (index: number) => baseY + 3 + Math.sin(index * 1.7 + phase) * 1.3 + Math.sin(index * .6) * 1.7;
    const a = [x, height(i), z], b = [x + 4, height(i + 1), z];
    const c = [x, baseY - 6, z + 3], d = [x + 4, baseY - 6, z + 3];
    const e = [x, height(i) - .8, z - 4], f = [x + 4, height(i + 1) - .8, z - 4];
    triangle(a, c, b, .86); triangle(b, c, d, .79);
    triangle(a, b, e, 1.05); triangle(b, f, e, 1);
    triangle(e, f, c, .7); triangle(f, d, c, .72);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 1,
    transparent: true, opacity: .26, depthWrite: false }));
  mesh.userData.noShadow = true;
  return mesh;
}

/** Shared atmosphere for PR02. Other landmarks remain provisional, outside the asset gate. */
export function buildWorld() {
  const scene = new Scene();
  scene.fog = new Fog(0xd9eee9, 22, 65);
  scene.background = null;
  scene.add(new HemisphereLight(0xe8f8ff, 0x66796b, 1.45));
  const sunlight = new DirectionalLight(0xffe6b6, 2.6);
  sunlight.position.set(-7, 12, 8); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -12, right: 12, top: 11, bottom: -9, near: 1, far: 40 });
  sunlight.shadow.normalBias = .025;
  sunlight.shadow.radius = 3;
  scene.add(sunlight);
  const scenery = new Group(); scenery.name = 'Atmospheric depth layers';
  scenery.add(ridge(-35, -13, 0xa8c5c7, .9), ridge(-25, -10, 0x8fafb0, 2.1), ridge(-18, -8, 0x749895, .2));
  scene.add(scenery);
  // A small waiting plinth is separate from every activity island.
  const waitingPlatform = new Group(); waitingPlatform.name = 'Guide waiting platform';
  const plinth = new Mesh(new CylinderGeometry(.86, .67, .38, 24),
    new MeshStandardMaterial({ color: 0xe5d8b7, roughness: .82 }));
  plinth.position.y = -.14; waitingPlatform.add(plinth);
  const top = new Mesh(new CylinderGeometry(.83, .83, .08, 24),
    new MeshStandardMaterial({ color: 0xf7f0dc, roughness: .75 }));
  top.position.y = .06; waitingPlatform.add(top);
  const trim = new Mesh(new TorusGeometry(.79, .035, 6, 36),
    new MeshStandardMaterial({ color: 0xd6b26d, roughness: .5, metalness: .2 }));
  trim.rotation.x = Math.PI / 2; trim.position.y = .105; waitingPlatform.add(trim);
  scene.add(waitingPlatform);
  const worlds = new Map<WorldId, Group>();
  const leaf = new SphereGeometry(.5, 12, 8);
  const trunk = new CylinderGeometry(.1, .16, 1.1, 8);
  const green = new MeshStandardMaterial({ color: 0x4c966e, roughness: .92 });
  const wood = new MeshStandardMaterial({ color: 0x986742, roughness: .9 });
  const rock = new IcosahedronGeometry(1, 0);
  const stone = new MeshStandardMaterial({ color: 0x8c9682, roughness: .94, flatShading: true });
  for (const [id, layout] of Object.entries(WORLD_LAYOUT) as [WorldId, typeof WORLD_LAYOUT[WorldId]][]) {
    const group = new Group(); group.position.set(layout.x, layout.y, layout.z); group.scale.setScalar(layout.scale);
    group.userData.worldId = id;
    const ground = new Mesh(new CylinderGeometry(1.92, .35, 1.5, 11), stone);
    ground.position.y = -.87; ground.receiveShadow = true; ground.castShadow = true; group.add(ground);
    const grass = new Mesh(new SphereGeometry(1, 20, 8), new MeshStandardMaterial({ color: layout.tint, roughness: 1 }));
    grass.position.y = -.17; grass.scale.set(2, .22, 1.92); group.add(grass);
    // The Math placeholder is removed once its authored model is loaded.
    if (id === 'math-quest') { scene.add(group); worlds.set(id, group); continue; }
    group.add(instances(rock, stone, Array.from({ length: 7 }, (_, i) => ({
      x: Math.cos(i * .95) * 1.55, y: -.43 - i % 3 * .15, z: Math.sin(i * .95) * 1.5,
      sx: .42, sy: .34 + i % 3 * .16, sz: .38, turn: i,
    }))));
    if (id === 'memory-match') {
      const stems: Placement[] = [], crowns: Placement[] = [];
      for (let i = 0; i < 7; i++) {
        const x = Math.cos(i * 2.4) * 1.13, z = Math.sin(i * 2.4) * 1.05;
        const height = 1 + i % 3 * .23;
        stems.push({ x, y: height * .52, z, sx: 1, sy: height, sz: 1 });
        for (let tier = 0; tier < 3; tier++) crowns.push({ x: x + Math.sin(i + tier) * .15,
          y: height + tier * .27, z: z + Math.cos(i + tier) * .12,
          sx: 1.08 - tier * .13, sy: .9, sz: 1.02 - tier * .1 });
      }
      group.add(instances(trunk, wood, stems), instances(leaf, green, crowns));
    } else if (id === 'sentence-builder') {
      const plaster = new MeshStandardMaterial({ color: 0xf9e3b3, roughness: .86 });
      const blue = new MeshStandardMaterial({ color: 0x478da2, roughness: .7 });
      const doorMaterial = new MeshStandardMaterial({ color: 0x725944, roughness: .9 });
      const house = new Mesh(new BoxGeometry(1.65, 1.25, 1.3), plaster);
      house.position.y = .65; group.add(house);
      const roof = new Mesh(new ConeGeometry(1.48, .9, 4), blue);
      roof.position.y = 1.74; roof.rotation.y = Math.PI / 4; group.add(roof);
      const door = new Mesh(new BoxGeometry(.42, .8, .07), doorMaterial);
      door.position.set(0, .43, .68); group.add(door);
      for (const x of [-.56, .56]) {
        const window = new Mesh(new BoxGeometry(.3, .45, .1), blue); window.position.set(x, .87, .69); group.add(window);
        const sill = new Mesh(new BoxGeometry(.42, .08, .14), plaster); sill.position.set(x, .61, .72); group.add(sill);
      }
      const shrubs = [{ x: -1.3, y: .28, z: .8, sx: 1, sy: .8, sz: .9 },
        { x: 1.25, y: .28, z: -.2, sx: 1, sy: .8, sz: .9 }];
      group.add(instances(leaf, green, shrubs));
    }
    scene.add(group); worlds.set(id, group);
  }
  const clouds = new Group();
  clouds.name = 'Near and distant cloud clusters';
  const cloudMaterial = new MeshStandardMaterial({ color: 0xfffbec, roughness: 1,
    transparent: true, opacity: .78, depthWrite: false });
  const puff = new SphereGeometry(1, 12, 8);
  const cloudPuffs: Placement[] = [];
  for (let i = 0; i < 10; i++) {
    const z = i < 6 ? -9 - i % 3 * 3 : 2 + i % 3 * 1.5;
    const x = i < 6 ? (i % 6 - 2.5) * 6 : (i % 2 ? -1 : 1) * (8 + i % 3);
    const y = i < 6 ? -2 - i % 3 * .7 : -3.2;
    for (let p = 0; p < 4; p++) cloudPuffs.push({ x: x + (p - 1.5) * .7,
      y: y + Math.sin(p * 1.8) * .25, z: z + Math.cos(p) * .25,
      sx: 1 + (p % 2) * .2, sy: .44 + (p % 3) * .12, sz: .65 });
  }
  clouds.add(instances(puff, cloudMaterial, cloudPuffs, false));
  scene.add(clouds);
  return { scene, worlds, sunlight, clouds, scenery, waitingPlatform };
}
