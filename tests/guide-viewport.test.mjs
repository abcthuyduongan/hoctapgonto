import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { fitGuideViewport } from '../src/world3d/scenes/guideViewport.ts';

function fixture() {
  const guide = new Group();
  const model = new Mesh(new BoxGeometry(1.6, 2.2, 1.6), new MeshBasicMaterial());
  model.position.y = 1.1;
  const bounds = new Box3().setFromObject(model);
  guide.add(model);
  return { guide, model, bounds };
}

function assertInside(guide, bounds, camera, viewport, width, height) {
  guide.updateMatrixWorld(true);
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new Vector3(x, y, z).applyMatrix4(guide.matrixWorld).project(camera);
        const pixelX = (point.x + 1) * width / 2;
        const pixelY = (1 - point.y) * height / 2;
        assert.ok(pixelX >= viewport.x && pixelX <= viewport.x + viewport.width,
          `Guide corner x=${pixelX} exceeds slot ${viewport.x}..${viewport.x + viewport.width}`);
        assert.ok(pixelY >= viewport.y && pixelY <= viewport.y + viewport.height,
          `Guide corner y=${pixelY} exceeds slot ${viewport.y}..${viewport.y + viewport.height}`);
        assert.ok(point.z > -1 && point.z < 1, 'rig remains inside camera near/far planes');
      }
    }
  }
}

const profiles = [
  { name: 'desktop left guide column', width: 1440, height: 900, slot: { x: 30, y: 390, width: 180, height: 250 } },
  { name: 'tablet portrait', width: 768, height: 1024, slot: { x: 24, y: 490, width: 150, height: 230 } },
  { name: 'mobile strip above the board', width: 390, height: 844, slot: { x: 18, y: 146, width: 70, height: 90 } },
  { name: 'small phone', width: 320, height: 568, slot: { x: 12, y: 106, width: 56, height: 70 } },
  { name: 'wide display near its left edge', width: 3200, height: 900, slot: { x: 12, y: 300, width: 220, height: 300 } },
];

for (const profile of profiles) {
  test(`full 3D guide volume fits the ${profile.name} DOM slot`, () => {
    const { guide, bounds } = fixture();
    const originalBounds = bounds.clone();
    const camera = new PerspectiveCamera(38, profile.width / profile.height, .1, 150);
    camera.position.set(0, 7, 21); camera.lookAt(0, .9, -4); camera.updateMatrixWorld();
    assert.equal(fitGuideViewport(guide, bounds, camera, profile.slot, profile.width, profile.height), true);
    assert.equal(guide.visible, true);
    assertInside(guide, bounds, camera, profile.slot, profile.width, profile.height);
    assert.ok(bounds.equals(originalBounds), 'fitting must preserve canonical asset bounds');
  });
}

test('the same rig can move between responsive slots without retaining its previous placement', () => {
  const { guide, bounds, model } = fixture();
  for (const profile of [...profiles, ...profiles.toReversed()]) {
    const camera = new PerspectiveCamera(38, profile.width / profile.height, .1, 150);
    camera.position.set(0, 7, 21); camera.lookAt(0, .9, -4); camera.updateMatrixWorld();
    fitGuideViewport(guide, bounds, camera, profile.slot, profile.width, profile.height);
    assertInside(guide, bounds, camera, profile.slot, profile.width, profile.height);
    assert.equal(guide.children.length, 1, 'slot updates reuse the existing rig');
    assert.equal(guide.children[0], model);
  }
});

test('malformed and empty slots hide the guide without introducing invalid transforms', () => {
  const { guide, bounds } = fixture();
  const camera = new PerspectiveCamera(38, 1, .1, 150);
  camera.position.set(0, 7, 21); camera.lookAt(0, .9, -4); camera.updateMatrixWorld();
  const valid = { x: 20, y: 100, width: 80, height: 120 };
  const cases = [
    { ...valid, width: 0 }, { ...valid, height: -1 }, { ...valid, x: Number.NaN },
    { ...valid, y: Number.POSITIVE_INFINITY }, { ...valid, width: Number.NaN },
  ];
  for (const slot of cases) {
    assert.equal(fitGuideViewport(guide, bounds, camera, slot, 390, 844), false);
    assert.equal(guide.visible, false);
    assert.ok([...guide.position.toArray(), ...guide.scale.toArray(), ...guide.quaternion.toArray()].every(Number.isFinite));
  }
  assert.equal(fitGuideViewport(guide, bounds, camera, valid, 0, 844), false);
  assert.equal(fitGuideViewport(guide, new Box3(), camera, valid, 390, 844), false);
  assert.equal(fitGuideViewport(guide, bounds, camera, valid, 390, 844), true);
  assert.equal(guide.visible, true, 'guide recovers when a real slot becomes available');
});
