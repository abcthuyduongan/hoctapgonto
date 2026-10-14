import { Scene, Group, Mesh, MeshStandardMaterial, CylinderGeometry,
  HemisphereLight, DirectionalLight, Fog, TorusGeometry } from 'three';
import { WORLD_LAYOUT } from './worldLayout';
import type { WorldId } from '../engine';

/** Stable scene anchors; all activity landmarks and atmospheric art come from GLBs. */
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
  const scenery = new Group(); scenery.name = 'Authored atmospheric environment';
  const clouds = new Group(); clouds.name = 'Authored cloud banks';
  scene.add(scenery, clouds);
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
  for (const [id, layout] of Object.entries(WORLD_LAYOUT) as [WorldId, typeof WORLD_LAYOUT[WorldId]][]) {
    const group = new Group();
    group.position.set(layout.x, layout.y, layout.z); group.scale.setScalar(layout.scale);
    group.userData.worldId = id;
    scene.add(group); worlds.set(id, group);
  }
  return { scene, worlds, sunlight, clouds, scenery, waitingPlatform };
}
