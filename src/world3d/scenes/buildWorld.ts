import { Scene, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry,
  ConeGeometry, BoxGeometry, HemisphereLight, DirectionalLight, Fog } from 'three';
import { WORLD_LAYOUT } from './worldLayout';
import type { WorldId } from '../engine';

/** Temporary landmarks for unapproved islands; never counted as premium assets. */
export function buildWorld() {
  const scene = new Scene();
  scene.fog = new Fog(0xc9eef5, 28, 68);
  scene.background = null;
  scene.add(new HemisphereLight(0xe7f7ff, 0x766b87, 1.6));
  const sunlight = new DirectionalLight(0xfff1d4, 2.8);
  sunlight.position.set(-8, 14, 9); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 45 });
  sunlight.shadow.normalBias = .035;
  scene.add(sunlight);
  const worlds = new Map<WorldId, Group>();
  const leaf = new SphereGeometry(.5, 12, 8);
  const trunk = new CylinderGeometry(.1, .16, 1.1, 8);
  const green = new MeshStandardMaterial({ color: 0x489975, roughness: .85 });
  const wood = new MeshStandardMaterial({ color: 0x8a5b3b, roughness: .88 });
  for (const [id, layout] of Object.entries(WORLD_LAYOUT) as [WorldId, typeof WORLD_LAYOUT[WorldId]][]) {
    const group = new Group(); group.position.set(layout.x, 0, layout.z);
    group.userData.worldId = id;
    const ground = new Mesh(new CylinderGeometry(2, 1.1, 1.45, 32), new MeshStandardMaterial({ color: layout.tint, roughness: .85 }));
    ground.position.y = -1; ground.receiveShadow = true; ground.castShadow = true; group.add(ground);
    if (id === 'memory-match') {
      for (let i = 0; i < 7; i++) {
        const x = Math.cos(i * 2.4) * 1.25, z = Math.sin(i * 2.4) * 1.1;
        const tree = new Mesh(trunk, wood); tree.position.set(x, .2, z); group.add(tree);
        const crown = new Mesh(leaf, green); crown.position.set(x, .9 + i % 2 * .25, z); crown.scale.set(1, 1.4, 1); group.add(crown);
      }
    } else if (id === 'sentence-builder') {
      const house = new Mesh(new BoxGeometry(1.7, 1.3, 1.35), new MeshStandardMaterial({ color: 0xffeac0, roughness: .72 }));
      house.position.y = .4; group.add(house);
      const roof = new Mesh(new ConeGeometry(1.5, .9, 4), new MeshStandardMaterial({ color: 0x5f8fa6, roughness: .6 }));
      roof.position.y = 1.5; roof.rotation.y = Math.PI / 4; group.add(roof);
    }
    scene.add(group); worlds.set(id, group);
  }
  const clouds = new Group();
  const cloudMaterial = new MeshStandardMaterial({ color: 0xfff8ee, roughness: 1 });
  const puff = new SphereGeometry(1, 12, 8);
  for (let i = 0; i < 12; i++) {
    const cloud = new Mesh(puff, cloudMaterial);
    cloud.position.set((i % 4 - 1.5) * 9 + Math.sin(i) * 2, 4 + i % 3, -9 - Math.floor(i / 4) * 6);
    cloud.userData.noShadow = true;
    cloud.scale.set(2.6, .6, 1.2); clouds.add(cloud);
  }
  scene.add(clouds);
  return { scene, worlds, sunlight, clouds };
}
