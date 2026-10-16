import { expect, test, type Page } from '@playwright/test';
import { getSceneTheme } from '../../src/world3d/scenes/sceneCatalog';
import type { WorldId } from '../../src/world3d/engine';

test.use({ serviceWorkers: 'block' });
const selectWorld = (page: Page, id: string) => page.getByRole('button', { name: `Chọn ${getSceneTheme(id as WorldId).world}`, exact: true }).click();

const assetIds = ['environment', 'fox-guide', 'language-world', 'math-world', 'memory-world'];
const stats = (page: Page) => page.locator('canvas.ba3d-canvas').evaluate(canvas => JSON.parse(canvas.getAttribute('data-diagnostics') ?? '{}'));
async function ready(page: Page) {
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', 'three-webgl');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect.poll(async () => (await stats(page)).drawCalls).toBeGreaterThan(0);
}

test('Quality changes and every game retain one live canvas/context, one RAF, five fetches and complete bitmap disposal', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const pending = new Set<number>(), contexts = new WeakSet<object>(), bitmaps: { closes: number }[] = [], known = new WeakMap<ImageBitmap, { closes: number }>();
    const raf = requestAnimationFrame.bind(window), cancel = cancelAnimationFrame.bind(window); let contextCount = 0;
    window.requestAnimationFrame = callback => { const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      const value = getContext.apply(this, [kind, ...args] as Parameters<typeof getContext>);
      if (/^(webgl2?|experimental-webgl)$/.test(kind) && value && !contexts.has(value)) { contexts.add(value); contextCount++; }
      return value;
    } as typeof getContext;
    const bitmap = createImageBitmap.bind(window), close = ImageBitmap.prototype.close;
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const value = await bitmap(...args), record = { closes: 0 }; bitmaps.push(record); known.set(value, record); return value;
    }) as typeof createImageBitmap;
    ImageBitmap.prototype.close = function () { const record = known.get(this); if (record) record.closes++; close.call(this); };
    (window as unknown as { __qualityLifecycle: () => { pendingRaf: number; contexts: number; decoded: number; closes: number[] } }).__qualityLifecycle = () => ({ pendingRaf: pending.size, contexts: contextCount, decoded: bitmaps.length, closes: bitmaps.map(value => value.closes) });
  });
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) requests.push(new URL(request.url()).pathname); });
  page.on('pageerror', error => errors.push(error.message));
  const lifecycle = () => page.evaluate(() => (window as unknown as { __qualityLifecycle: () => { pendingRaf: number; contexts: number; decoded: number; closes: number[] } }).__qualityLifecycle());
  await page.goto('/?view=games&controls=1'); await ready(page);
  const initial = [...requests]; expect([...initial].sort()).toEqual(assetIds.map(id => `/models/${id}.glb`));
  await page.locator('canvas.ba3d-canvas').evaluate(canvas => canvas.setAttribute('data-quality-original', 'yes'));
  const snapshots = [];
  for (const choice of ['high', 'low', 'balanced', 'low', 'high']) {
    await page.getByLabel('Chất lượng cảnh 3D').selectOption(choice);
    await expect.poll(async () => (await stats(page)).tier).toBe(choice);
    await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(1);
    expect((await lifecycle()).contexts).toBe(1);
    expect(requests).toEqual(initial);
    await expect(page.locator('canvas[data-quality-original="yes"]')).toHaveCount(1);
    snapshots.push(await stats(page));
  }
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('low');
  for (const id of ['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail']) {
    await selectWorld(page, id);
    await page.locator(`.ba3d-${id} .ba3d-play`).click();
    await expect(page.locator('.ba37-game-scene-slot canvas[data-quality-original="yes"]')).toHaveCount(1);
    await expect.poll(async () => (await stats(page)).gameWorld).toBe(id);
    await expect.poll(async () => (await stats(page)).tier).toBe('low');
    await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(1);
    expect((await lifecycle()).contexts).toBe(1); expect(requests).toEqual(initial);
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('.immersive-dialog')).toHaveCount(0);
  }
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(0);
  expect((await stats(page)).paused).toBe(true);
  const stoppedTime = (await stats(page)).animationTime;
  await page.waitForTimeout(500); expect((await stats(page)).animationTime).toBe(stoppedTime);
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(1);
  await expect.poll(async () => (await stats(page)).animationTime).toBeGreaterThan(stoppedTime);
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(0);
  const disposed = await lifecycle();
  expect(disposed.decoded).toBeGreaterThan(0);
  expect(disposed.closes).toHaveLength(disposed.decoded);
  expect(disposed.closes.every(count => count === 1), 'Every decoded bitmap closes exactly once after all quality changes and five games').toBe(true);
  expect(disposed.contexts).toBe(1); expect(requests).toEqual(initial); expect(errors).toEqual([]);
  await testInfo.attach('quality-lifecycle-budget', { body: JSON.stringify({ requests, snapshots, disposed }, null, 2), contentType: 'application/json' });
});

test('Low detail reduces actual island geometry by at least 25 percent and high restores original geometry, materials and shadows', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  let productionModule = '';
  page.on('response', response => { if (/\/assets\/PremiumWorldRenderer-[^/]+\.js$/.test(response.url())) productionModule = response.url(); });
  const requests: string[] = [];
  page.on('request', request => { if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto('/?view=games&controls=1'); await ready(page); expect(productionModule).not.toBe('');
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  requests.length = 0;
  const result = await page.evaluate(async moduleUrl => {
    const exports = await import(moduleUrl);
    // Vite can expose this dynamically shared chunk through a namespace export.
    // Resolve the actual exported renderer API instead of assuming chunk names.
    const api = typeof exports.createPremiumRenderer === 'function' ? exports
      : Object.values(exports).find((value: any) => value && typeof value.createPremiumRenderer === 'function');
    if (!api) throw new Error('Built renderer chunk has no exported createPremiumRenderer API');
    const { createPremiumRenderer } = api as { createPremiumRenderer: (...args: any[]) => Promise<any> };
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:1000px;height:700px;pointer-events:none'; document.body.append(canvas);
    const controller = new AbortController();
    const instance = await createPremiumRenderer({ canvas, signal: controller.signal, quality: 'high', motionOn: false, paused: false, onSelect() {}, onContextLost() {} });
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const inspect = () => {
      let islandTriangles = 0;
      const visibleGeometries: string[] = [], allMaterials = new Set<string>(), allTextures = new Set<string>();
      const visible = (node: any) => { for (let current = node; current; current = current.parent) if (!current.visible) return false; return true; };
      instance.world.scene.traverse((node: any) => {
        if (!node.isMesh) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          allMaterials.add(material.uuid);
          for (const value of Object.values(material) as any[]) if (value?.isTexture) allTextures.add(value.uuid);
        }
      });
      for (const root of instance.world.worlds.values()) root.traverse((node: any) => {
        if (!node.isMesh || !visible(node)) return;
        const geometry = node.geometry;
        const available = geometry.index?.count ?? geometry.attributes.position.count;
        const start = geometry.drawRange.start ?? 0;
        const count = Math.min(available - start, geometry.drawRange.count);
        islandTriangles += Math.max(0, count) / 3 * (node.isInstancedMesh ? node.count : 1);
        visibleGeometries.push(geometry.uuid);
      });
      return { islandTriangles, visibleGeometries: visibleGeometries.sort(), materials: [...allMaterials].sort(), textures: [...allTextures].sort(),
        shadowMapEnabled: instance.renderer.shadowMap.enabled, sunlightCastShadow: instance.world.sunlight.castShadow,
        gpuTextures: instance.renderer.info.memory.textures, diagnostics: instance.getDiagnostics() };
    };
    try {
      await frame(); const high = inspect();
      instance.setQuality('low'); await frame();
      const deadline = performance.now() + 30_000;
      while (instance.getDiagnostics().lodState !== 'ready') {
        if (performance.now() > deadline) throw new Error(`LOD cache did not become ready: ${instance.getDiagnostics().lodState}`);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      await frame(); const low = inspect();
      instance.setQuality('high'); await frame(); const restored = inspect();
      instance.setQuality('low'); await frame(); instance.setQuality('high'); await frame(); const repeated = inspect();
      instance.setGameScene('math-quest'); instance.setMotion(true);
      await new Promise(resolve => setTimeout(resolve, 350)); const gameShadowBefore = instance.getDiagnostics();
      await new Promise(resolve => setTimeout(resolve, 500)); const gameShadowAfter = instance.getDiagnostics();
      instance.setQuality('balanced'); await frame(); const gameShadowDirtied = instance.getDiagnostics();
      instance.setMotion(false); await frame();
      return { high, low, restored, repeated, gameShadowBefore, gameShadowAfter, gameShadowDirtied };
    } finally { instance.dispose(); controller.abort(); canvas.remove(); }
  }, productionModule);
  expect(requests).toHaveLength(5);
  expect(requests.map(url => new URL(url).pathname).sort()).toEqual(assetIds.map(id => `/models/${id}.glb`));
  expect(result.high.diagnostics.lodState).toBe('idle');
  expect(result.high.diagnostics.geometryDetail).toBe('full');
  expect(result.low.diagnostics.lodState).toBe('ready');
  expect(result.low.diagnostics.geometryDetail).toBe('reduced');
  expect(result.restored.diagnostics.geometryDetail).toBe('full');
  expect(result.high.islandTriangles).toBeGreaterThan(30_000);
  expect(result.low.islandTriangles, 'Compare visible indexed geometry without shadow-pass inflation or DPR differences').toBeLessThanOrEqual(result.high.islandTriangles * .75);
  expect(result.low.visibleGeometries).not.toEqual(result.high.visibleGeometries);
  expect(result.restored.islandTriangles).toBe(result.high.islandTriangles);
  expect(result.restored.visibleGeometries).toEqual(result.high.visibleGeometries);
  expect(result.repeated.visibleGeometries).toEqual(result.high.visibleGeometries);
  for (const variant of [result.low, result.restored, result.repeated]) {
    expect(variant.materials, 'Geometry detail changes reuse the decoded PBR materials').toEqual(result.high.materials);
    expect(variant.textures, 'Geometry detail changes share the same texture objects').toEqual(result.high.textures);
  }
  expect(result.low.shadowMapEnabled).toBe(false); expect(result.low.sunlightCastShadow).toBe(false);
  expect(result.restored.shadowMapEnabled).toBe(true); expect(result.restored.sunlightCastShadow).toBe(true);
  expect(Number.isFinite(result.gameShadowBefore.shadowUpdates)).toBe(true);
  expect(result.gameShadowAfter.frames).toBeGreaterThan(result.gameShadowBefore.frames);
  expect(result.gameShadowAfter.shadowUpdates, 'An idle game reuses its static island shadow while the non-shadow-casting fox continues animating').toBe(result.gameShadowBefore.shadowUpdates);
  expect(result.gameShadowDirtied.shadowUpdates, 'A quality change invalidates the cached shadow on the next real draw').toBeGreaterThan(result.gameShadowAfter.shadowUpdates);
  await testInfo.attach('actual-low-high-geometry-and-resource-identity', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});

test('An unavailable optional LOD chunk preserves the original premium scene and every game without refetching GLBs', async ({ page }, testInfo) => {
  const models: string[] = [], legacy: string[] = [], optional: string[] = [], errors: string[] = [];
  page.on('request', request => {
    if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) models.push(request.url());
    if (/legacyAdapter-[^/]+\.js/.test(request.url())) legacy.push(request.url());
    if (/geometryLod-[^/]+\.js/.test(request.url())) optional.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/geometryLod-*.js', route => route.fulfill({ status: 404, contentType: 'text/javascript', body: '// QA optional quality module unavailable' }));
  await page.goto('/?view=games&controls=1'); await ready(page);
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('balanced');
  const original = await stats(page), initialModels = [...models];
  expect(initialModels).toHaveLength(5);
  expect(optional).toEqual([]);
  expect(original.geometryDetail).toBe('full');
  await page.locator('canvas.ba3d-canvas').evaluate(canvas => canvas.setAttribute('data-optional-lod-original', 'yes'));
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('low');
  await expect.poll(async () => (await stats(page)).lodState).toBe('unavailable');
  await expect.poll(async () => (await stats(page)).drawCalls).toBeGreaterThan(0);
  const unavailable = await stats(page);
  expect(unavailable.tier).toBe('low'); expect(unavailable.dpr).toBeLessThanOrEqual(1);
  expect(unavailable.geometryDetail).toBe('full');
  expect(unavailable.triangles).toBeGreaterThan(30_000);
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', 'three-webgl');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('canvas[data-optional-lod-original="yes"]')).toHaveCount(1);
  const games = [];
  for (const id of ['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail']) {
    await selectWorld(page, id);
    await page.locator(`.ba3d-${id} .ba3d-play`).click();
    await expect(page.locator('.immersive-dialog.premium-game')).toBeVisible();
    await expect(page.locator('.ba37-game-scene-slot canvas[data-optional-lod-original="yes"]')).toHaveCount(1);
    await expect.poll(async () => (await stats(page)).gameWorld).toBe(id);
    await expect.poll(async () => (await stats(page)).guideVisible).toBe(true);
    games.push(await stats(page));
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('.immersive-dialog')).toHaveCount(0);
  }
  expect(models).toEqual(initialModels); expect(legacy).toEqual([]); expect(optional).toHaveLength(1); expect(errors).toEqual([]);
  await testInfo.attach('optional-LOD-failure-preserves-premium', { body: JSON.stringify({ original, unavailable, games, models, optional, legacy, errors }, null, 2), contentType: 'application/json' });
});
