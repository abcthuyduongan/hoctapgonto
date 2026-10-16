import { expect, test, type Page } from '@playwright/test';
import { getSceneTheme } from '../../src/world3d/scenes/sceneCatalog';
import type { WorldId } from '../../src/world3d/engine';

test.use({ serviceWorkers: 'block' });
const selectWorld = (page: Page, id: string) => page.getByRole('button', { name: `Chọn ${getSceneTheme(id as WorldId).world}`, exact: true }).click();

const assetIds = ['environment', 'fox-guide', 'language-world', 'math-world', 'memory-world'];
const pr03Ids = ['memory-world', 'language-world', 'environment'];
const stats = (page: Page) => page.locator('.ba3d-render-host').evaluate(host => JSON.parse(host.getAttribute('data-diagnostics') ?? '{}'));
async function ready(page: Page) {
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', 'three-webgl');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect.poll(async () => (await stats(page)).drawCalls).toBeGreaterThan(0);
}

test('All five actual production GLBs download in a two-request window with embedded PBR images and usable geometry', async ({ page }, testInfo) => {
  let inFlight = 0, maximum = 0;
  const requests: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/models\/[^/]+\.glb$/.test(request.url())) { requests.push(request.url()); inFlight++; maximum = Math.max(maximum, inFlight); }
  });
  page.on('requestfinished', request => { if (/\/models\/[^/]+\.glb$/.test(request.url())) inFlight--; });
  page.on('requestfailed', request => { if (/\/models\/[^/]+\.glb$/.test(request.url())) inFlight--; });
  await page.route('**/models/*.glb', async route => {
    // Hold each real response long enough to expose an unbounded Promise.all
    // implementation; the actual server response and GLTF decoding still run.
    await new Promise(resolve => setTimeout(resolve, 120));
    await route.continue();
  });
  const responses = assetIds.map(id => page.waitForResponse(response => response.url().endsWith(`/models/${id}.glb`) && response.status() === 200));
  await page.goto('/?view=games&controls=1'); await ready(page);
  expect(requests.map(url => new URL(url).pathname).sort()).toEqual(assetIds.map(id => `/models/${id}.glb`));
  expect(maximum, 'GLB fetching remains bounded to two in flight').toBeLessThanOrEqual(2);
  expect(maximum).toBeGreaterThan(0);
  expect([...(await stats(page)).readyAssets].sort()).toEqual(assetIds);
  const metadata = [];
  for (let index = 0; index < responses.length; index++) {
    const bytes = await (await responses[index]).body();
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
    expect(json.buffers.every((buffer: { uri?: string }) => !buffer.uri)).toBe(true);
    expect(json.images.length).toBeGreaterThanOrEqual(3);
    expect(json.images.every((image: { bufferView?: number; uri?: string }) => Number.isInteger(image.bufferView) && !image.uri)).toBe(true);
    expect(json.meshes.length).toBeGreaterThan(0);
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
      expect(primitive.attributes.POSITION).toBeDefined();
      expect(primitive.attributes.NORMAL).toBeDefined();
      expect(primitive.attributes.TEXCOORD_0).toBeDefined();
      const material = json.materials[primitive.material];
      expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      expect(material.normalTexture).toBeDefined();
    }
    if (pr03Ids.includes(assetIds[index])) {
      expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024);
      expect(json.asset.extras.provenance).toBe('ORIGINAL_PROCEDURAL_V37_PR03');
      expect(json.asset.extras.acceptance).toBe('candidate-not-art-approved');
    }
    metadata.push({ id: assetIds[index], bytes: bytes.length, meshes: json.meshes.length, images: json.images.length, materials: json.materials.length, provenance: json.asset.extras.provenance });
  }
  expect(errors).toEqual([]);
  await testInfo.attach('five-production-GLBs-and-concurrency', { body: JSON.stringify({ maximum, requests, metadata }, null, 2), contentType: 'application/json' });
});

test('The real production renderer imports textured Memory, Language and Environment volumes and retains decoded maps in each game', async ({ page }, testInfo) => {
  let moduleUrl = '';
  page.on('response', response => { if (/\/assets\/PremiumWorldRenderer-[^/]+\.js$/.test(response.url())) moduleUrl = response.url(); });
  await page.goto('/?view=games&controls=1'); await ready(page); expect(moduleUrl).not.toBe('');
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  const runtime = await page.evaluate(async productionModule => {
    const exports = await import(productionModule);
    const { createPremiumRenderer } = exports.createPremiumRenderer ? exports
      : Object.values(exports).find((value: any) => typeof value?.createPremiumRenderer === 'function') as any;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:-2000px;top:0;width:800px;height:600px;pointer-events:none'; document.body.append(canvas);
    const signal = new AbortController();
    const renderer = await createPremiumRenderer({ canvas, signal: signal.signal, quality: 'low', motionOn: false, paused: false, onSelect() {}, onContextLost() {} });
    const inspect = (root: any, visibleOnly = false) => {
      const meshes: { name: string; triangles: number; uvCount: number; pbrTextures: boolean; widths: number[] }[] = [];
      root.traverse((node: any) => {
        if (!node.isMesh) return;
        if (visibleOnly) { let current = node; while (current) { if (!current.visible) return; current = current.parent; } }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        meshes.push({ name: node.name, triangles: (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3,
          uvCount: node.geometry.attributes.uv?.count ?? 0,
          pbrTextures: materials.every((material: any) => material.isMeshStandardMaterial && material.map && material.normalMap && material.roughnessMap && material.metalnessMap),
          widths: materials.flatMap((material: any) => [material.map, material.normalMap, material.roughnessMap, material.metalnessMap].filter(Boolean).map(map => map.image?.width ?? 0)) });
      });
      return { meshes, triangles: meshes.reduce((total, mesh) => total + mesh.triangles, 0) };
    };
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const home = Object.fromEntries(['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail'].map(id => [id, inspect(renderer.world.worlds.get(id))]));
      const environment = inspect(renderer.world.scenery);
      const clouds = inspect(renderer.world.clouds);
      const games = [];
      for (const id of ['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail']) {
        renderer.setGameScene(id); renderer.setGuideMood('happy');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        games.push({ id, stats: renderer.getDiagnostics(), visibleWorld: inspect(renderer.world.worlds.get(id), true), environment: inspect(renderer.gameEnvironments.root, true), texturesInGPU: renderer.renderer.info.memory.textures });
      }
      return { home, environment, clouds, games };
    } finally { renderer.dispose(); signal.abort(); canvas.remove(); }
  }, moduleUrl);
  for (const id of ['memory-match', 'sentence-builder', 'word-connect', 'sequence-trail']) {
    const volume = runtime.home[id];
    expect(volume.meshes.length).toBeGreaterThan(10);
    expect(volume.triangles).toBeGreaterThan(500);
    expect(volume.triangles).toBeLessThanOrEqual(35_000);
    if (id === 'memory-match' || id === 'sentence-builder') {
      expect(volume.meshes.every((mesh: { uvCount: number; pbrTextures: boolean; widths: number[] }) => mesh.uvCount > 0 && mesh.pbrTextures && mesh.widths.every(width => width > 0))).toBe(true);
    } else {
      // These two scenes retain a decoded textured GLB base and add authored
      // procedural landmarks whose solid-color materials do not use maps.
      const textured = volume.meshes.filter((mesh: { pbrTextures: boolean }) => mesh.pbrTextures);
      expect(textured.length, `${id}: decoded textured base meshes remain present`).toBeGreaterThan(10);
      expect(textured.every((mesh: { uvCount: number; widths: number[] }) => mesh.uvCount > 0 && mesh.widths.every(width => width > 0))).toBe(true);
      expect(volume.meshes.every((mesh: { uvCount: number }) => mesh.uvCount > 0)).toBe(true);
    }
  }
  expect(runtime.environment.meshes.length + runtime.clouds.meshes.length).toBeGreaterThan(5);
  expect([...runtime.environment.meshes, ...runtime.clouds.meshes].every((mesh: { pbrTextures: boolean }) => mesh.pbrTextures)).toBe(true);
  for (const game of runtime.games) {
    expect(game.stats.sceneMode).toBe('game'); expect(game.stats.gameWorld).toBe(game.id);
    expect([...game.stats.readyAssets].sort()).toEqual(assetIds);
    expect(game.visibleWorld.meshes.length).toBeGreaterThan(0);
    expect(game.environment.meshes.some((mesh: { pbrTextures: boolean; widths: number[] }) => mesh.pbrTextures && mesh.widths.every(width => width > 0)), 'Each interior reuses decoded textured environment geometry').toBe(true);
    expect(game.texturesInGPU).toBeGreaterThan(10);
    expect(game.stats.drawCalls).toBeGreaterThan(0);
  }
  await testInfo.attach('decoded-PR03-scene-textures', { body: JSON.stringify(runtime, null, 2), contentType: 'application/json' });
});

for (const id of pr03Ids) {
  test(`Missing new ${id} GLB replaces the premium canvas safely while every game still opens`, async ({ page }) => {
    await page.route(`**/models/${id}.glb`, route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA required PR03 model unavailable' }));
    await page.goto('/?view=games&controls=1');
    await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
    await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
    for (const [world, stage] of [['math-quest', '.quiz-question'], ['memory-match', '.memory-grid'], ['sentence-builder', '.sentence-bank'], ['word-connect', '.connect-board'], ['sequence-trail', '.trail-bank']]) {
      await selectWorld(page, world);
      await page.locator(`.ba3d-${world} .ba3d-play`).click(); await expect(page.locator(stage)).toBeVisible();
      await expect(page.locator('.ba37-mascot-fallback')).toBeVisible();
      await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    }
  });
}

test('An actual embedded PNG decode failure in the new Memory model falls back safely and still records a Math answer', async ({ page }) => {
  await page.route('**/models/memory-world.glb', async route => {
    const response = await route.fetch(), bytes = Buffer.from(await response.body());
    const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());
    const view = json.bufferViews[json.images[0].bufferView];
    const imageStart = 20 + jsonLength + 8 + (view.byteOffset ?? 0);
    expect([...bytes.subarray(imageStart, imageStart + 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    bytes.fill(0, imageStart, imageStart + 8);
    const headers = { ...response.headers() };
    delete headers['content-encoding']; delete headers['content-length']; delete headers.etag;
    await route.fulfill({ response, headers, body: bytes });
  });
  await page.goto('/?view=games&controls=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  await selectWorld(page, 'math-quest');
  await page.locator('.ba3d-math-quest .ba3d-play').click(); await page.locator('.answer-option').first().click();
  await expect(page.locator('.feedback-win')).toBeVisible();
});

test('A decoded Math material-name validation failure closes every catalog bitmap exactly once before fallback', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const records: { closes: number }[] = [];
    const known = new WeakMap<ImageBitmap, { closes: number }>();
    const bitmap = window.createImageBitmap.bind(window), close = ImageBitmap.prototype.close;
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const value = await bitmap(...args);
      const record = { closes: 0 }; records.push(record); known.set(value, record); return value;
    }) as typeof createImageBitmap;
    ImageBitmap.prototype.close = function () {
      const record = known.get(this); if (record) record.closes++;
      close.call(this);
    };
    (window as unknown as { __artBitmaps: () => { decoded: number; closes: number[] } }).__artBitmaps = () => ({ decoded: records.length, closes: records.map(record => record.closes) });
  });
  await page.route('**/models/math-world.glb', async route => {
    const response = await route.fetch(), bytes = Buffer.from(await response.body());
    const source = Buffer.from('"name":"Living mint grass"'), replacement = Buffer.from('"name":"Absent mint grass"');
    expect(replacement.length).toBe(source.length);
    const offset = bytes.indexOf(source, 20);
    expect(offset, 'Rename the actual declared Math material without altering any GLB offsets').toBeGreaterThan(20);
    replacement.copy(bytes, offset);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
    expect(json.materials.some((material: { name: string }) => material.name === 'Living mint grass')).toBe(false);
    expect(json.materials.some((material: { name: string }) => material.name === 'Absent mint grass')).toBe(true);
    const headers = { ...response.headers() };
    delete headers['content-encoding']; delete headers['content-length']; delete headers.etag;
    await route.fulfill({ response, headers, body: bytes });
  });
  await page.goto('/?view=games&controls=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
  await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  const probe = () => page.evaluate(() => (window as unknown as { __artBitmaps: () => { decoded: number; closes: number[] } }).__artBitmaps());
  await expect.poll(async () => (await probe()).decoded).toBe(87);
  await expect.poll(async () => (await probe()).closes.filter(count => count === 1).length).toBe(87);
  expect((await probe()).closes.every(count => count === 1), 'No decoded bitmap is leaked or closed twice during initialization failure').toBe(true);
  await selectWorld(page, 'memory-match');
  await page.locator('.ba3d-memory-match .ba3d-play').click();
  await expect(page.locator('.memory-card')).toHaveCount(12);
  await testInfo.attach('decoded-catalog-failure-bitmap-cleanup', { body: JSON.stringify(await probe(), null, 2), contentType: 'application/json' });
});
