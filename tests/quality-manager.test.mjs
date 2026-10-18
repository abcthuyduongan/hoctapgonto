import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityManager, QUALITY } from '../src/world3d/renderer/qualityManager.ts';
import { PerformanceMetrics } from '../src/world3d/renderer/performanceMetrics.ts';

function samples(manager, count, frameMs, now) {
  let changed = null;
  for (let i = 0; i < count; i++) changed = manager.observe(frameMs, now);
  return changed;
}

test('auto begins conservatively and manual tiers preserve the selected quality', () => {
  assert.equal(new QualityManager('auto', true).tier, 'low');
  assert.equal(new QualityManager('auto', false).tier, 'balanced');
  for (const tier of ['low', 'balanced', 'high']) {
    const manager = new QualityManager(tier, true);
    assert.equal(manager.tier, tier);
    assert.equal(samples(manager, 1200, 60, 60000), null);
    assert.equal(samples(manager, 1200, 10, 120000), null);
    assert.equal(manager.tier, tier);
  }
  assert.equal(QUALITY.low.maxDpr, 1);
  assert.equal(QUALITY.balanced.maxDpr, 1.5);
  assert.equal(QUALITY.high.maxDpr, 2);
  assert.equal(QUALITY.low.shadows, false);
  assert.equal(QUALITY.balanced.particles, false);
});

test('auto degrades only after sustained slow frames and ignores a short spike', () => {
  const manager = new QualityManager('auto', false);
  assert.equal(samples(manager, 119, 39, 15000), null);
  assert.equal(manager.tier, 'balanced');
  assert.equal(manager.observe(38, 15000), null);
  assert.equal(samples(manager, 119, 39, 15000), null);
  assert.equal(manager.observe(39, 15000), 'low');
  assert.equal(manager.tier, 'low');
  assert.equal(samples(manager, 500, 60, 60000), null);
  assert.equal(manager.tier, 'low');
});

test('automatic quality responds to sustained severe stalls before the ordinary cooldown, but keeps a brief decode spike',()=>{
  const manager=new QualityManager('auto',false);
  assert.equal(samples(manager,29,90,2600),null);assert.equal(manager.tier,'balanced');
  assert.equal(manager.observe(16,2700),null);
  assert.equal(samples(manager,29,90,5400),null);assert.equal(manager.tier,'balanced');
  assert.equal(manager.observe(90,5490),'low');assert.equal(manager.tier,'low');
  assert.equal(samples(manager,600,16,10_000),null);assert.equal(manager.tier,'low');
  assert.equal(manager.observe(16,20_490),'balanced');
  const manual=new QualityManager('high',false);assert.equal(samples(manual,60,120,7200),null);assert.equal(manual.tier,'high');
});

test('hysteresis requires enough fast samples, resets interrupted streaks, and caps automatic upgrades', () => {
  const manager = new QualityManager('auto', true);
  assert.equal(samples(manager, 599, 18, 15000), null);
  assert.equal(manager.observe(19, 15000), null);
  assert.equal(samples(manager, 599, 18, 15000), null);
  assert.equal(manager.observe(18, 15000), 'balanced');
  assert.equal(samples(manager, 1200, 10, 60000), null);
  assert.equal(manager.tier, 'balanced');
});

test('quality changes observe the minimum cooldown even with sufficient samples', () => {
  const manager = new QualityManager('auto', false);
  assert.equal(samples(manager, 120, 50, 14999), null);
  assert.equal(manager.observe(50, 15000), 'low');
  assert.equal(samples(manager, 600, 16, 29999), null);
  assert.equal(manager.tier, 'low');
  assert.equal(manager.observe(16, 30000), 'balanced');
  assert.equal(samples(manager, 120, 50, 44999), null);
  assert.equal(manager.observe(50, 45000), 'low');
});

test('manual selection resets prior streaks before returning to auto', () => {
  const manager = new QualityManager('auto', false);
  samples(manager, 119, 50, 15000);
  manager.setChoice('high');
  assert.equal(manager.tier, 'high');
  assert.equal(samples(manager, 120, 50, 16000), null);
  manager.setChoice('auto');
  assert.equal(manager.tier, 'high');
  assert.equal(manager.observe(50, 20000), null);
  assert.equal(samples(manager, 119, 50, 20000), 'balanced');
  assert.equal(manager.tier, 'balanced');
});

test('invalid frame samples cannot trigger automatic changes', () => {
  const manager = new QualityManager('auto', false);
  for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.equal(samples(manager, 700, value, 60000), null);
    assert.equal(manager.tier, 'balanced');
  }
  assert.equal(samples(manager, 119, 45, 60000), null);
  assert.equal(manager.observe(45, 60000), 'low');
});

test('metrics calculate FPS from median duration and expose P95 as frame milliseconds', () => {
  const metrics = new PerformanceMetrics();
  assert.deepEqual(metrics.snapshot(), { frames: 0 });
  let now = 100;
  metrics.record(now);
  for (const duration of [40, 10, 30, 20]) metrics.record(now += duration);
  assert.deepEqual(metrics.snapshot(), { frames: 4, fpsMedian: 33.3, fpsP95FrameMs: 40 });
  assert.deepEqual(metrics.snapshot(), { frames: 4, fpsMedian: 33.3, fpsP95FrameMs: 40 });
});

test('metrics omit pause gaps and invalid intervals without losing valid frame history', () => {
  const metrics = new PerformanceMetrics();
  metrics.record(100);
  metrics.record(116);
  metrics.resetClock();
  metrics.record(10000);
  assert.equal(metrics.frames, 1);
  metrics.record(10016);
  metrics.record(10016);
  metrics.record(10006);
  metrics.record(11006);
  assert.deepEqual(metrics.snapshot(), { frames: 2, fpsMedian: 62.5, fpsP95FrameMs: 16 });
  metrics.record(11022);
  assert.equal(metrics.frames, 3);
});

test('metrics use a bounded recent window while keeping the cumulative sample count', () => {
  const metrics = new PerformanceMetrics();
  let now = 100;
  metrics.record(now);
  for (let i = 0; i < 190; i++) metrics.record(now += 16);
  for (let i = 0; i < 180; i++) metrics.record(now += 40);
  assert.deepEqual(metrics.snapshot(), { frames: 370, fpsMedian: 25, fpsP95FrameMs: 40 });
});
