import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { WorldCarouselController } from '../src/world3d/scenes/WorldCarouselController.ts';
import { carouselLayout, WORLD_IDS, WORLD_ISLANDS } from '../src/world3d/scenes/worldLayout.ts';
import { orbitSlots } from '../src/world3d/scenes/islandCarousel.ts';

const close = (actual, expected, label = '') => assert.ok(
  Math.abs(actual - expected) < 1e-9, `${label}: ${actual} differs from ${expected}`,
);

function fixture(ids = WORLD_IDS) {
  const roots = new Map(ids.map(id => [id, new Group()]));
  const guide = new Group();
  const waiting = new Group();
  const controller = new WorldCarouselController(roots, guide, waiting);
  return { controller, roots, guide, waiting };
}

function runToRest(controller) {
  for (let step = 0; controller.moving && step < 300; step++) controller.advance(1 / 60);
  assert.equal(controller.moving, false, 'transition must finish');
}

function assertLanding({ controller, roots, guide }, id) {
  const island = roots.get(id);
  const landing = WORLD_ISLANDS.find(item => item.id === id)?.landing ?? [-1.1, .04, 1.1];
  close(guide.position.x, island.position.x + landing[0] * island.scale.x, 'landing x');
  close(guide.position.y, island.position.y + landing[1] * island.scale.y, 'landing y');
  close(guide.position.z, island.position.z + landing[2] * island.scale.z, 'landing z');
  close(guide.rotation.y, 0, 'guide faces forward after landing');
  const snapshot = controller.snapshot();
  assert.equal(snapshot.selectedWorld, id);
  assert.equal(snapshot.mascotLocation, id);
  assert.equal(snapshot.mascotState, 'on-island');
  assert.equal(snapshot.jumpProgress, 1);
  assert.equal(snapshot.carouselMoving, false);
}

test('entrance presents equal islands and the fox waits outside them', () => {
  const { controller, roots, guide, waiting } = fixture();
  const poses = [...roots.values()];
  assert.equal(controller.selected, null);
  assert.equal(controller.moving, false);
  assert.equal(controller.mascotLocation, 'waiting');
  assert.equal(controller.mascotState, 'waiting');
  assert.equal(waiting.visible, true);
  close(guide.position.x, waiting.position.x);
  close(guide.position.z, waiting.position.z);
  assert.ok(guide.position.x < Math.min(...poses.map(root => root.position.x)), 'fox waits to the left of the island row');
  assert.ok(guide.position.y > waiting.position.y);
  assert.ok(poses.every(root => guide.position.z > root.position.z + 3));
  for (const root of poses) {
    close(root.position.y, poses[0].position.y);
    close(root.position.z, poses[0].position.z);
    close(root.scale.x, poses[0].scale.x);
    assert.equal(root.parent, null, 'guide position does not depend on island parenting');
  }
  close(poses.reduce((sum, root) => sum + root.position.x, 0), 0);
  assert.equal(new Set(poses.map(root => root.position.x)).size, WORLD_IDS.length);
});

test('selection rises through a visible jump and lands precisely on the chosen island', () => {
  const actual = fixture();
  const { controller, guide, waiting } = actual;
  const initialHeight = guide.position.y;
  assert.equal(controller.select('memory-match', true), true);
  assert.equal(controller.mascotState, 'jumping');
  const heights = [];
  while (controller.moving) {
    controller.advance(1 / 60);
    heights.push(guide.position.y);
  }
  const peak = Math.max(...heights);
  assert.ok(peak > initialHeight + 1, 'jump must visibly lift the fox');
  assert.ok(heights.indexOf(peak) > 0 && heights.indexOf(peak) < heights.length - 1);
  assert.ok(peak > guide.position.y + 1, 'fox descends to island ground');
  assert.equal(waiting.visible, false);
  assertLanding(actual, 'memory-match');
});

test('moving from Memory to Language follows an arc and brings Language in front', () => {
  const actual = fixture();
  const { controller, roots } = actual;
  controller.select('memory-match', false);
  const before = [...roots].map(([id, root]) => [id, root.position.clone()]);
  controller.select('sentence-builder', true);
  for (let step = 0; step < 10; step++) controller.advance(.05);
  const middle = [...roots].map(([id, root]) => [id, root.position.clone()]);
  runToRest(controller);
  const deviationFromChord = middle.map(([id, pose]) => {
    const start = before.find(([key]) => key === id)[1];
    const end = roots.get(id).position;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    return Math.abs(dx * (start.z - pose.z) - (start.x - pose.x) * dz) / Math.hypot(dx, dz);
  });
  assert.ok(Math.max(...deviationFromChord) > .5, 'positions should bend around the orbit');
  const selected = roots.get('sentence-builder');
  close(selected.position.x, 0, 'selected centered');
  for (const [id, root] of roots) {
    if (id === 'sentence-builder') continue;
    assert.ok(selected.position.z > root.position.z, 'selected island is nearest the camera');
    assert.ok(selected.scale.x > root.scale.x, 'selected island is larger');
  }
  assertLanding(actual, 'sentence-builder');
});

test('reselecting an island and choosing an unknown island do not restart motion', () => {
  const { controller, guide, roots } = fixture();
  controller.select('math-quest', true);
  controller.advance(.05);
  const before = controller.snapshot();
  const position = guide.position.clone();
  assert.equal(controller.select('math-quest', true), false);
  assert.deepEqual(controller.snapshot(), before);
  assert.ok(guide.position.equals(position));
  assert.equal(controller.select('missing-island', true), false);
  assert.deepEqual(controller.snapshot(), before);
  assert.equal(roots.size, 3);
  runToRest(controller);
  assert.equal(controller.select('math-quest', true), false);
  assert.equal(controller.moving, false);
});

test('twenty rapid retargets preserve every current position and land on the latest choice', () => {
  const actual = fixture();
  const { controller, roots, guide } = actual;
  let maxHeight = guide.position.y;
  let latest;
  for (let index = 0; index < 20; index++) {
    latest = WORLD_IDS[(index + 1) % WORLD_IDS.length];
    const guideBefore = guide.position.clone();
    const posesBefore = [...roots].map(([id, root]) => ({ id, position: root.position.clone(), scale: root.scale.clone() }));
    assert.equal(controller.select(latest, true), true);
    assert.ok(guide.position.equals(guideBefore), 'retarget must not teleport the fox');
    for (const pose of posesBefore) {
      assert.ok(roots.get(pose.id).position.equals(pose.position), 'retarget must not teleport islands');
      assert.ok(roots.get(pose.id).scale.equals(pose.scale), 'retarget must preserve current island scale');
    }
    for (let step = 0; step < 5; step++) {
      controller.advance(1 / 60);
      maxHeight = Math.max(maxHeight, guide.position.y);
      assert.ok(Number.isFinite(guide.position.x + guide.position.y + guide.position.z));
    }
  }
  while (controller.moving) {
    controller.advance(1 / 60);
    maxHeight = Math.max(maxHeight, guide.position.y);
  }
  assert.ok(maxHeight < 3, `rapid selections must not accumulate airborne height: ${maxHeight}`);
  assertLanding(actual, latest);
  const settled = controller.snapshot();
  for (let step = 0; step < 120; step++) controller.advance(1 / 60);
  assert.deepEqual(controller.snapshot(), settled, 'old transitions must not complete afterward');
});

test('continuous frame-by-frame retargeting cannot accumulate airborne height', () => {
  const actual = fixture();
  const { controller, guide } = actual;
  let maxHeight = guide.position.y;
  let latest;
  for (let index = 0; index < 500; index++) {
    latest = WORLD_IDS[index % WORLD_IDS.length];
    const positionBefore = guide.position.clone();
    assert.equal(controller.select(latest, true), true);
    assert.ok(guide.position.equals(positionBefore), 'even prolonged retargeting must preserve x/y/z');
    controller.advance(1 / 60);
    maxHeight = Math.max(maxHeight, guide.position.y);
    assert.ok(guide.position.y <= 2.3, `fox exceeds the desktop jump ceiling: ${guide.position.y}`);
  }
  assert.ok(maxHeight > 1, 'stress run actually exercises airborne transitions');
  runToRest(controller);
  assertLanding(actual, latest);
});

test('reduced motion and settling midflight land immediately without stale animation', () => {
  const actual = fixture();
  const { controller, guide } = actual;
  assert.equal(controller.select('sentence-builder', false), true);
  assertLanding(actual, 'sentence-builder');
  controller.select('memory-match', true);
  for (let step = 0; step < 8; step++) controller.advance(.05);
  assert.equal(controller.moving, true);
  assert.ok(guide.position.y > 1);
  controller.settle();
  assertLanding(actual, 'memory-match');
  const rest = controller.snapshot();
  controller.advance(5);
  assert.deepEqual(controller.snapshot(), rest);
});

test('responsive configuration preserves selection with valid feet coordinates', () => {
  const actual = fixture();
  const { controller, guide } = actual;
  controller.select('math-quest', false);
  const desktopPosition = guide.position.clone();
  controller.configure(true);
  assertLanding(actual, 'math-quest');
  assert.ok(!guide.position.equals(desktopPosition), 'mobile composition uses its own landing');
  controller.select('sentence-builder', true);
  controller.advance(.05);
  controller.configure(false);
  assertLanding(actual, 'sentence-builder');
  controller.configure(true);
  assertLanding(actual, 'sentence-builder');
  controller.configure(false);
  assertLanding(actual, 'sentence-builder');
});

test('returning to the entrance restores peers and the waiting platform', () => {
  const { controller, roots, guide, waiting } = fixture();
  const entrance = controller.snapshot();
  controller.select('memory-match', false);
  controller.select(null, true);
  runToRest(controller);
  assert.equal(controller.selected, null);
  assert.equal(controller.mascotState, 'waiting');
  assert.equal(controller.mascotLocation, 'waiting');
  assert.equal(waiting.visible, true);
  close(guide.position.x, waiting.position.x);
  close(guide.position.z, waiting.position.z);
  assert.deepEqual(controller.snapshot().islands, entrance.islands);
  assert.ok([...roots.values()].every(root => guide.position.z > root.position.z));
});

test('five runtime islands each rotate to the front without hardcoded triplets', () => {
  const ids = [...WORLD_IDS, 'music-studio', 'creative-lab'];
  const actual = fixture(ids);
  const { controller, roots } = actual;
  assert.equal(controller.snapshot().islands.length, 5);
  for (const id of ids) {
    controller.select(id, true);
    runToRest(controller);
    const selected = roots.get(id);
    close(selected.position.x, 0, 'five-island selection centered');
    for (const [otherId, root] of roots) {
      if (otherId !== id) assert.ok(selected.position.z > root.position.z);
    }
    assert.equal(new Set([...roots.values()].map(root => `${root.position.x.toFixed(8)},${root.position.z.toFixed(8)}`)).size, 5);
    assertLanding(actual, id);
  }
});

test('additional islands grow both orbit axes with enough settled footprint clearance', () => {
  for (const mobile of [false, true]) for (const count of [2, 3, 5, 8, 12]) {
    const ids = Array.from({ length: count }, (_, index) => `future-${index}`);
    const layout = carouselLayout(mobile, count);
    const poses = orbitSlots(ids, 0, layout.radiusX, layout.radiusZ, layout.centerZ, layout.orbitScale);
    poses[ids[0]].scale = layout.frontScale;
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      const a = poses[ids[i]], b = poses[ids[j]];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2.25 * (a.scale + b.scale) - 1e-9,
        `${count} ${mobile ? 'mobile' : 'desktop'} islands must keep their bounded footprints separate`);
    }
  }
});
