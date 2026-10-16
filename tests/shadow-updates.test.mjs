import test from 'node:test';
import assert from 'node:assert/strict';
import { ShadowUpdates } from '../src/world3d/renderer/shadowUpdates.ts';

test('Static games reuse the shadow map until scenery changes', () => {
  const shadows = new ShadowUpdates();
  assert.equal(shadows.shouldUpdate(0, 'balanced', true, true), true);
  for (const now of [16, 33, 1000, 20000]) assert.equal(shadows.shouldUpdate(now, 'balanced', true, true), false);
  shadows.request();
  assert.equal(shadows.shouldUpdate(20016, 'balanced', true, true), true);
  assert.equal(shadows.shouldUpdate(20033, 'balanced', true, true), false);
  assert.equal(shadows.updates, 2);
});
test('Moving home balanced shadows update at most about 30 times per second', () => {
  const shadows = new ShadowUpdates();
  assert.equal(shadows.shouldUpdate(0, 'balanced', false, true), true);
  assert.equal(shadows.shouldUpdate(16, 'balanced', false, true), false);
  assert.equal(shadows.shouldUpdate(32, 'balanced', false, true), true);
  assert.equal(shadows.shouldUpdate(48, 'balanced', false, true), false);
  shadows.request();
  assert.equal(shadows.shouldUpdate(49, 'balanced', false, true), true, 'A layout change paints immediately');
});
test('Low quality never allocates shadow passes; enabling shadows consumes the pending change', () => {
  const shadows = new ShadowUpdates();
  assert.equal(shadows.shouldUpdate(0, 'low', false, true), false);
  shadows.request();
  assert.equal(shadows.shouldUpdate(1000, 'low', true, false), false);
  assert.equal(shadows.updates, 0);
  assert.equal(shadows.shouldUpdate(1016, 'high', true, false), true);
  assert.equal(shadows.shouldUpdate(1032, 'high', true, false), false);
});
test('High home motion keeps live shadows while reduced motion renders once per change', () => {
  const shadows = new ShadowUpdates();
  for (const now of [0, 16, 32]) assert.equal(shadows.shouldUpdate(now, 'high', false, true), true);
  assert.equal(shadows.shouldUpdate(48, 'high', false, false), false);
  shadows.request();
  assert.equal(shadows.shouldUpdate(49, 'high', false, false), true);
  assert.equal(shadows.shouldUpdate(65, 'high', false, false), false);
});
