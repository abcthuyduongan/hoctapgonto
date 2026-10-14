import { expect, test, type Page } from '@playwright/test';

type WorldId = 'math-quest' | 'memory-match' | 'sentence-builder';
type Position = { x: number; y: number; z: number };
type Diagnostics = {
  selectedWorld: WorldId | null;
  carouselMoving: boolean;
  rotation: number;
  islands: (Position & { id: WorldId; scale: number })[];
  mascotLocation: 'waiting' | WorldId;
  mascotState: 'waiting' | 'jumping' | 'on-island';
  mascotPosition: Position;
  jumpProgress: number;
  drawCalls: number;
  frames: number;
  motion: boolean;
  tier: string;
};
const worlds: WorldId[] = ['math-quest', 'memory-match', 'sentence-builder'];
const stats = async (page: Page): Promise<Diagnostics> => JSON.parse(await page.locator('.ba3d-render-host').getAttribute('data-diagnostics') || '{}');
const select = (page: Page, id: WorldId) => page.locator(`.ba3d-${id} .ba3d-world-name`);

async function openWorld(page: Page) {
  await page.goto('/?premium3d=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', 'three-webgl');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect.poll(async () => (await stats(page)).drawCalls).toBeGreaterThan(0);
  await expect.poll(async () => (await stats(page)).islands?.length).toBe(3);
}

function expectNeutral(value: Diagnostics) {
  expect(value.selectedWorld).toBeNull();
  expect(value.carouselMoving).toBe(false);
  expect(value.mascotLocation).toBe('waiting');
  expect(value.mascotState).toBe('waiting');
  expect(value.mascotPosition.x, 'The guide must wait at the left corner, outside the central island row').toBeLessThan(0);
  const ordered = [...value.islands].sort((a, b) => a.x - b.x);
  expect(new Set(ordered.map(island => island.id))).toEqual(new Set(worlds));
  for (const island of ordered) {
    expect(island.scale).toBeCloseTo(ordered[0].scale, 5);
    expect(island.y).toBeCloseTo(ordered[0].y, 5);
    expect(island.z).toBeCloseTo(ordered[0].z, 5);
  }
  expect(ordered[1].x - ordered[0].x).toBeGreaterThan(0);
  expect(ordered[1].x - ordered[0].x).toBeCloseTo(ordered[2].x - ordered[1].x, 5);
}

function expectChosen(value: Diagnostics, id: WorldId) {
  expect(value.selectedWorld).toBe(id);
  expect(value.carouselMoving).toBe(false);
  expect(value.mascotLocation).toBe(id);
  expect(value.mascotState).toBe('on-island');
  const chosen = value.islands.find(island => island.id === id)!;
  for (const other of value.islands.filter(island => island.id !== id)) {
    expect(chosen.z, `${id} must be the foremost island`).toBeGreaterThan(other.z);
    expect(chosen.scale, `${id} must be visually promoted`).toBeGreaterThan(other.scale);
  }
}

async function settled(page: Page, id: WorldId) {
  await expect.poll(async () => {
    const value = await stats(page);
    return { selected: value.selectedWorld, moving: value.carouselMoving, location: value.mascotLocation, state: value.mascotState };
  }).toEqual({ selected: id, moving: false, location: id, state: 'on-island' });
  expectChosen(await stats(page), id);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  if (viewport.width !== 768) {
    test(`Initial carousel gives all islands equal standing and the guide waits at the left corner at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await openWorld(page);
      expectNeutral(await stats(page));
      await expect(page.locator('.ba3d-world-name[aria-pressed="true"]')).toHaveCount(0);
      await testInfo.attach(`initial-carousel-${viewport.width}x${viewport.height}`, { body: await page.screenshot(), contentType: 'image/png' });
    });
  }

  test(`Fox and waiting platform fit completely inside the left corner, initially and after overview, at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    let productionModule = '';
    page.on('response', response => {
      if (/\/assets\/PremiumWorldRenderer-[^/]+\.js(?:\?|$)/.test(response.url())) productionModule = response.url();
    });
    await page.setViewportSize(viewport);
    await openWorld(page);
    const canvasSize = await page.locator('canvas.ba3d-canvas').evaluate(canvas => ({ width: canvas.clientWidth, height: canvas.clientHeight }));
    expect(productionModule).not.toBe('');
    await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
    await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
    const evidence = await page.evaluate(async ({ moduleUrl, size }) => {
      const { createPremiumRenderer } = await import(moduleUrl);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = `position:fixed;left:-2000px;top:0;width:${size.width}px;height:${size.height}px;pointer-events:none`;
      document.body.append(canvas);
      const signal = new AbortController();
      const renderer = await createPremiumRenderer({ canvas, signal: signal.signal, quality: 'low', motionOn: false, paused: false, onSelect() {}, onContextLost() {} });
      const rendered = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // Project each actual fox/platform mesh box through the production camera.
      // Using actual skinned-mesh bounds catches clipping that an x<0 world
      // coordinate cannot. No public product globals or debug UI are required.
      const projectBounds = (root: any) => {
        root.updateMatrixWorld(true);
        renderer.camera.updateMatrixWorld(true);
        const points: { x: number; y: number; z: number }[] = [];
        let meshes = 0;
        root.traverse((node: any) => {
          if (!node.isMesh || !node.visible) return;
          if (node.isSkinnedMesh) node.computeBoundingBox();
          else node.geometry.computeBoundingBox();
          const box = node.isSkinnedMesh ? node.boundingBox : node.geometry.boundingBox;
          if (!box || box.isEmpty()) return;
          meshes++;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const corner = renderer.guideAnchor.position.clone().set(x, y, z).applyMatrix4(node.matrixWorld).project(renderer.camera);
            points.push({ x: (corner.x + 1) * size.width / 2, y: (1 - corner.y) * size.height / 2, z: corner.z });
          }
        });
        return { visible: root.visible, meshes, left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
          top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)),
          minDepth: Math.min(...points.map(point => point.z)), maxDepth: Math.max(...points.map(point => point.z)) };
      };
      const snapshot = () => ({ diagnostics: renderer.getDiagnostics(), fox: projectBounds(renderer.guideAnchor), platform: projectBounds(renderer.world.waitingPlatform) });
      try {
        await rendered();
        const initial = snapshot();
        renderer.focusOn('memory-match');
        await rendered();
        renderer.focusOn(null);
        await rendered();
        return { size, initial, overview: snapshot() };
      } finally { renderer.dispose(); signal.abort(); canvas.remove(); }
    }, { moduleUrl: productionModule, size: canvasSize });
    for (const [state, value] of Object.entries({ initial: evidence.initial, overview: evidence.overview })) {
      expectNeutral(value.diagnostics as Diagnostics);
      for (const [name, bounds] of Object.entries({ fox: value.fox, platform: value.platform })) {
        expect(bounds.visible, `${state}: ${name} is visible`).toBe(true);
        expect(bounds.meshes, `${state}: ${name} contains rendered meshes`).toBeGreaterThan(0);
        expect(bounds.left, `${state}: ${name} left edge stays in the canvas`).toBeGreaterThanOrEqual(0);
        expect(bounds.right, `${state}: ${name} right edge stays in the canvas`).toBeLessThanOrEqual(evidence.size.width);
        expect(bounds.top, `${state}: ${name} top edge stays in the canvas`).toBeGreaterThanOrEqual(0);
        expect(bounds.bottom, `${state}: ${name} bottom edge stays in the canvas`).toBeLessThanOrEqual(evidence.size.height);
        expect(bounds.minDepth).toBeGreaterThanOrEqual(-1);
        expect(bounds.maxDepth).toBeLessThanOrEqual(1);
      }
      expect((value.fox.left + value.fox.right) / 2, `${state}: fox waits in the left third of the screen`).toBeLessThan(evidence.size.width / 3);
    }
    await testInfo.attach(`waiting-guide-projected-bounds-${viewport.width}x${viewport.height}`, { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  });
}

test('Selecting each island rotates it forward, lands the guide there and survives leaving its control', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openWorld(page);
  const waiting = (await stats(page)).mascotPosition;
  const samples = [];
  for (const id of worlds) {
    await select(page, id).click();
    await settled(page, id);
    await expect(select(page, id)).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1200);
    const value = await stats(page);
    expectChosen(value, id);
    expect(Math.hypot(value.mascotPosition.x - waiting.x, value.mascotPosition.y - waiting.y, value.mascotPosition.z - waiting.z), 'The guide must leave its initial waiting position').toBeGreaterThan(0.5);
    samples.push(value);
  }
  expect(errors).toEqual([]);
  await testInfo.attach('carousel-selection-and-arrival', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('The actual built renderer rotates through intermediate positions and moves the guide along an airborne arc', async ({ page }, testInfo) => {
  let productionModule = '';
  page.on('response', response => {
    if (/\/assets\/PremiumWorldRenderer-[^/]+\.js(?:\?|$)/.test(response.url())) productionModule = response.url();
  });
  await openWorld(page);
  expect(productionModule, 'Observe the real production chunk on the network').not.toBe('');
  // Unmount the visible renderer so the integration harness does not compete
  // for the GPU. The harness imports the observed production chunk, never src.
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  const movement = await page.evaluate(async moduleUrl => {
    const { createPremiumRenderer } = await import(moduleUrl);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:-600px;top:0;width:512px;height:512px;pointer-events:none';
    document.body.append(canvas);
    const signal = new AbortController();
    const renderer = await createPremiumRenderer({ canvas, signal: signal.signal, quality: 'low', motionOn: true, paused: false, onSelect() {}, onContextLost() {} });
    try {
      const initial = renderer.getDiagnostics();
      renderer.focusOn('memory-match');
      const samples = [];
      const began = performance.now();
      while (performance.now() - began < 6000) {
        await new Promise(resolve => setTimeout(resolve, 20));
        const sample = renderer.getDiagnostics(); samples.push(sample);
        if (!sample.carouselMoving && sample.mascotState === 'on-island') break;
      }
      return { initial, samples, final: renderer.getDiagnostics() };
    } finally { renderer.dispose(); signal.abort(); canvas.remove(); }
  }, productionModule) as { initial: Diagnostics; samples: Diagnostics[]; final: Diagnostics };
  expectNeutral(movement.initial);
  expectChosen(movement.final, 'memory-match');
  expect(movement.samples.some(sample => sample.carouselMoving)).toBe(true);
  expect(movement.samples.some(sample => sample.rotation !== movement.initial.rotation && sample.rotation !== movement.final.rotation), 'Rotation must move through an intermediate angle').toBe(true);
  const airborne = movement.samples.filter(sample => sample.mascotState === 'jumping' && sample.jumpProgress > 0.05 && sample.jumpProgress < 0.95);
  expect(airborne.length, 'Sample a real moving guide, not an instantaneous teleport').toBeGreaterThan(2);
  const highest = Math.max(...airborne.map(sample => sample.mascotPosition.y));
  expect(highest, 'Jump rises above both its start and destination').toBeGreaterThan(Math.max(movement.initial.mascotPosition.y, movement.final.mascotPosition.y) + 0.3);
  expect(new Set(airborne.map(sample => sample.mascotPosition.x)).size + new Set(airborne.map(sample => sample.mascotPosition.z)).size).toBeGreaterThan(4);
  expect(movement.final.drawCalls).toBeGreaterThan(0);
  await testInfo.attach('production-carousel-jump-samples', { body: JSON.stringify(movement, null, 2), contentType: 'application/json' });
});

test('Rapid choices settle on the latest island without new model fetches or a stale arrival', async ({ page }) => {
  const modelRequests: string[] = [];
  page.on('request', request => { if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
  await openWorld(page);
  const initialRequests = [...modelRequests];
  for (const id of ['math-quest', 'sentence-builder', 'math-quest', 'memory-match'] as WorldId[]) await select(page, id).click();
  await page.mouse.move(0, 0);
  await settled(page, 'memory-match');
  await page.waitForTimeout(1800);
  expectChosen(await stats(page), 'memory-match');
  expect(modelRequests).toEqual(initialRequests);
});

test('Overview explicitly returns the guide to its left waiting corner and restores the equal island row', async ({ page }) => {
  await openWorld(page);
  const initial = await stats(page);
  expectNeutral(initial);
  await select(page, 'sentence-builder').click();
  await settled(page, 'sentence-builder');
  await page.locator('.ba3d-overview-reset').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Tổng quan các đảo', exact: true })).toBeFocused();
  await expect.poll(async () => {
    const value = await stats(page);
    return { selected: value.selectedWorld, moving: value.carouselMoving, location: value.mascotLocation, state: value.mascotState };
  }).toEqual({ selected: null, moving: false, location: 'waiting', state: 'waiting' });
  const reset = await stats(page);
  expectNeutral(reset);
  await expect(page.getByRole('group', { name: 'Tổng quan các đảo', exact: true })).toBeFocused();
  for (const coordinate of ['x', 'y', 'z'] as const) expect(reset.mascotPosition[coordinate]).toBeCloseTo(initial.mascotPosition[coordinate], 5);
  await expect(page.locator('.ba3d-world-name[aria-pressed="true"]')).toHaveCount(0);
});

test('Quality and responsive resize preserve the chosen island and the guide arrival', async ({ page }) => {
  await openWorld(page);
  await select(page, 'sentence-builder').click();
  await settled(page, 'sentence-builder');
  for (const quality of ['low', 'high']) {
    await page.getByLabel('Chất lượng cảnh 3D').selectOption(quality);
    await expect.poll(async () => (await stats(page)).tier).toBe(quality);
    await settled(page, 'sentence-builder');
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await settled(page, 'sentence-builder');
    expect((await stats(page)).drawCalls).toBeGreaterThan(0);
    await expect(select(page, 'sentence-builder')).toHaveAttribute('aria-pressed', 'true');
  }
});

test('Reduced motion snaps selection and overview while leaving no continuing animation frame', async ({ page }) => {
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const nativeRaf = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = nativeRaf(time => { pending.delete(id); callback(time); });
      pending.add(id); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id); };
    (window as unknown as { __carouselPendingRaf: () => number }).__carouselPendingRaf = () => pending.size;
  });
  const pendingRaf = () => page.evaluate(() => (window as unknown as { __carouselPendingRaf: () => number }).__carouselPendingRaf());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWorld(page);
  expectNeutral(await stats(page));
  await expect.poll(pendingRaf).toBe(0);
  for (const id of worlds) {
    await select(page, id).click();
    await settled(page, id);
    const value = await stats(page);
    expect(value.motion).toBe(false);
    await expect.poll(pendingRaf).toBe(0);
    await page.waitForTimeout(1200);
    expect((await stats(page)).frames).toBe(value.frames);
    expectChosen(await stats(page), id);
  }
  await page.locator('.ba3d-overview-reset').click();
  await expect.poll(async () => (await stats(page)).mascotState).toBe('waiting');
  expectNeutral(await stats(page));
  await expect.poll(pendingRaf).toBe(0);
});
