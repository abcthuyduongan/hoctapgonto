import test from 'node:test';
import assert from 'node:assert/strict';
import {
  neutralSlots, orbitSlots, targetRotationForIndex, smoothStep, blendPose,
} from '../src/world3d/scenes/islandCarousel.ts';

const TAU = Math.PI * 2;
const close = (actual, expected, label = '') => assert.ok(
  Math.abs(actual - expected) < 1e-10, `${label}: ${actual} differs from ${expected}`,
);

for (const count of [2, 3, 5]) {
  const ids = Array.from({ length: count }, (_, index) => `island-${index}`);
  test(`${count} islands enter as equally sized, centered peers`, () => {
    const slots = neutralSlots(ids, 4, .3, -2, .9);
    assert.equal(Object.keys(slots).length, count);
    const poses = ids.map(id => slots[id]);
    assert.equal(new Set(poses.map(pose => pose.x)).size, count);
    close(poses.reduce((sum, pose) => sum + pose.x, 0), 0);
    for (const [index, pose] of poses.entries()) {
      assert.equal(pose.y, .3);
      assert.equal(pose.z, -2);
      assert.equal(pose.scale, .9);
      if (index) close(pose.x - poses[index - 1].x, 4);
    }
  });

  test(`${count} orbit slots are unique and each selected island reaches the front`, () => {
    for (let selected = 0; selected < count; selected++) {
      const rotation = targetRotationForIndex(selected, count, 9.7);
      const slots = orbitSlots(ids, rotation, 6, 4, -1, 1.1, .2);
      const poses = ids.map(id => slots[id]);
      assert.equal(new Set(poses.map(pose => `${pose.x.toFixed(8)},${pose.z.toFixed(8)}`)).size, count);
      close(slots[ids[selected]].x, 0, 'selected x');
      close(slots[ids[selected]].z, 3, 'selected z');
      for (const [index, pose] of poses.entries()) {
        close((pose.x / 6) ** 2 + ((pose.z + 1) / 4) ** 2, 1, 'ellipse');
        assert.equal(pose.y, .2);
        assert.equal(pose.scale, 1.1);
        if (index !== selected) assert.ok(pose.z < slots[ids[selected]].z);
      }
    }
  });
}

test('target rotations take the shortest arc across zero and many full turns', () => {
  for (const count of [2, 3, 5]) {
    for (const current of [-TAU * 7 - .05, -.05, .05, TAU * 12 + .05]) {
      for (let index = 0; index < count; index++) {
        const target = targetRotationForIndex(index, count, current);
        assert.ok(Math.abs(target - current) <= Math.PI + 1e-10);
        close(Math.sin(index * TAU / count + target), 0);
        close(Math.cos(index * TAU / count + target), 1);
        close(targetRotationForIndex(index, count, target), target, 'repeat selection');
      }
    }
  }
  close(targetRotationForIndex(0, 3, TAU - .05), TAU);
  close(targetRotationForIndex(0, 3, -TAU + .05), -TAU);
});

test('retargeting keeps the sampled current pose until the new transition advances', () => {
  const from = { x: -4, y: .2, z: -2, scale: .8 };
  const to = { x: 0, y: .7, z: 3, scale: 1.2 };
  const halfway = blendPose(from, to, .5);
  for (const [field, expected] of Object.entries({ x: -2, y: .45, z: .5, scale: 1 })) {
    close(halfway[field], expected, field);
  }
  const next = { x: 4, y: .4, z: -3, scale: .9 };
  assert.deepEqual(blendPose(halfway, next, 0), halfway);
  assert.deepEqual(blendPose(halfway, next, 1), next);
  assert.deepEqual(blendPose(from, to, -1), from);
  assert.deepEqual(blendPose(from, to, 2), to);
  assert.equal(smoothStep(-.1), 0);
  assert.equal(smoothStep(.5), .5);
  assert.equal(smoothStep(1.1), 1);
});

test('empty and single-island configurations avoid invalid coordinates', () => {
  assert.deepEqual(neutralSlots([], 4), {});
  assert.deepEqual(orbitSlots([], 0, 6, 4), {});
  assert.equal(targetRotationForIndex(0, 0, 7), 7);
  assert.deepEqual(neutralSlots(['only'], 4), { only: { x: 0, y: 0, z: 0, scale: 1 } });
  assert.deepEqual(orbitSlots(['only'], 0, 6, 4), { only: { x: 0, y: 0, z: 4, scale: 1 } });
  assert.throws(() => targetRotationForIndex(2, 2), RangeError);
});
