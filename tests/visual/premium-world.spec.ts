import { expect, test, type Page } from '@playwright/test';

type Diagnostics = {
  engine: string; readyAssets: string[]; animationClips: string[]; activeClip: string;
  drawCalls: number; triangles: number; textureBytesEstimate: number; frames: number;
  skeletalMeshes: number; bones: number; animationTime: number;
  motion: boolean; paused: boolean; tier: string; dpr: number;
  sceneMode: 'home' | 'game'; gameWorld: string | null;
};
async function diagnostics(page: Page): Promise<Diagnostics> {
  const raw = await page.locator('.ba3d-render-host').getAttribute('data-diagnostics');
  return JSON.parse(raw || '{}') as Diagnostics;
}
async function ready(page: Page, engine = 'three-webgl') {
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', engine);
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', engine === 'three-webgl' ? 'ready' : 'fallback');
}

test('Default home uses one premium scene with textured GLBs, rig and running clips', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const legacyRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/legacyAdapter/.test(request.url())) legacyRequests.push(request.url());
  });
  const foxResponse = page.waitForResponse(response => response.url().endsWith('/models/fox-guide.glb') && response.status() === 200);
  const mathResponse = page.waitForResponse(response => response.url().endsWith('/models/math-world.glb') && response.status() === 200);
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.ba3d-render-host')).toHaveCount(1);
  await expect(page.locator('.ba3d-render-host canvas.ba3d-canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^(Thử cảnh 3D mới|3D mới · thử nghiệm)$/ })).toHaveCount(0);
  expect(legacyRequests, 'Successful default premium initialization must not download a second renderer').toEqual([]);
  const parseGlb = (bytes: Buffer) => {
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
    return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim()) as {
      images: unknown[]; materials: { pbrMetallicRoughness?: { baseColorTexture?: unknown } }[];
      skins: { joints: number[] }[]; nodes: { skin?: number; mesh?: number }[];
      animations: { name: string; channels: { target: { node: number; path: string } }[] }[];
    };
  };
  const fox = parseGlb(await (await foxResponse).body());
  const math = parseGlb(await (await mathResponse).body());
  for (const asset of [fox, math]) {
    expect(asset.images.length).toBeGreaterThan(0);
    expect(asset.materials.some(material => material.pbrMetallicRoughness?.baseColorTexture)).toBeTruthy();
  }
  expect(fox.nodes.some(node => node.skin !== undefined && node.mesh !== undefined)).toBeTruthy();
  const joints = new Set(fox.skins.flatMap(skin => skin.joints));
  for (const name of ['Idle', 'Cheer', 'Victory']) {
    const animation = fox.animations.find(animation => animation.name === name);
    expect(animation, `${name} must exist in the downloaded GLB`).toBeTruthy();
    expect(animation!.channels.some(channel => joints.has(channel.target.node) && channel.target.path === 'rotation'), `${name} must animate an actual joint`).toBeTruthy();
  }
  await expect.poll(async () => (await diagnostics(page)).drawCalls).toBeGreaterThan(0);
  const initial = await diagnostics(page);
  expect([...initial.readyAssets].sort()).toEqual(['environment', 'fox-guide', 'language-world', 'math-world', 'memory-world']);
  expect(initial.animationClips).toEqual(expect.arrayContaining(['Idle', 'Cheer', 'Victory']));
  expect(initial.skeletalMeshes).toBeGreaterThan(0);
  expect(initial.bones).toBeGreaterThan(0);
  expect(initial.triangles).toBeGreaterThan(0);
  expect(initial.textureBytesEstimate).toBeGreaterThan(0);
  await expect.poll(async () => (await diagnostics(page)).animationTime).toBeGreaterThan(initial.animationTime);
  await page.getByRole('button', { name: 'Xem đảo Đảo Toán Học', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await diagnostics(page)).activeClip).toBe('Cheer');
  await expect.poll(async () => (await diagnostics(page)).activeClip).toBe('Idle');
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('low');
  await expect.poll(async () => (await diagnostics(page)).tier).toBe('low');
  expect((await diagnostics(page)).dpr).toBeLessThanOrEqual(1);
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('high');
  await expect.poll(async () => (await diagnostics(page)).tier).toBe('high');
  await testInfo.attach('premium-desktop-runtime', { body: await page.screenshot(), contentType: 'image/png' });
  await testInfo.attach('runtime-diagnostics', { body: JSON.stringify(await diagnostics(page), null, 2), contentType: 'application/json' });
  await expect(page.locator('.ba3d-render-host canvas.ba3d-canvas')).toHaveCount(1);
  expect(legacyRequests, 'Selection and quality changes must keep the same renderer').toEqual([]);
  expect(errors).toEqual([]);
});

test('All three decoded skeletal clips deform bones in the actual production renderer', async ({ page }, testInfo) => {
  let productionModule = '';
  page.on('response', response => {
    if (/\/assets\/PremiumWorldRenderer-[^/]+\.js(?:\?|$)/.test(response.url())) productionModule = response.url();
  });
  await page.goto('/?premium3d=1');
  await ready(page);
  expect(productionModule, 'Use the lazily loaded production module observed on the network').not.toBe('');
  // A focused integration harness imports the real built factory, not /src or
  // a test mock. Inspecting its loaded controller avoids adding QA globals or
  // animation debug controls to the product merely to trigger Victory.
  const clips = await page.evaluate(async moduleUrl => {
    const { createPremiumRenderer } = await import(moduleUrl);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:-600px;top:0;width:512px;height:512px;pointer-events:none';
    document.body.append(canvas);
    const signal = new AbortController();
    const renderer = await createPremiumRenderer({ canvas, signal: signal.signal, quality: 'low', motionOn: true, paused: false, onSelect() {}, onContextLost() {} });
    try {
      const controller = renderer.mascot;
      const bonePose = () => {
        const pose: number[] = [];
        controller.mixer.getRoot().traverse((node: { isBone?: boolean; quaternion: { toArray(): number[] } }) => {
          if (node.isBone) pose.push(...node.quaternion.toArray());
        });
        return pose;
      };
      const results = [];
      for (const name of ['Idle', 'Cheer', 'Victory']) {
        controller.play(name);
        const before = bonePose();
        const timeBefore = renderer.getDiagnostics().animationTime;
        await new Promise(resolve => setTimeout(resolve, 250));
        const after = bonePose();
        results.push({ name, activeClip: renderer.getDiagnostics().activeClip,
          animatedBones: before.length / 4,
          largestBoneRotationChange: Math.max(...after.map((component, index) => Math.abs(component - before[index]))),
          timeAdvance: renderer.getDiagnostics().animationTime - timeBefore,
          drawCalls: renderer.getDiagnostics().drawCalls });
      }
      return results;
    } finally { renderer.dispose(); signal.abort(); canvas.remove(); }
  }, productionModule);
  for (const clip of clips) {
    expect(clip.activeClip).toBe(clip.name);
    expect(clip.animatedBones).toBeGreaterThan(0);
    expect(clip.largestBoneRotationChange, `${clip.name} must move a rig joint, not just translate the model root`).toBeGreaterThan(0.001);
    expect(clip.timeAdvance).toBeGreaterThan(0);
    expect(clip.drawCalls).toBeGreaterThan(0);
  }
  await testInfo.attach('actual-bone-clip-playback', { body: JSON.stringify(clips, null, 2), contentType: 'application/json' });
});

test('Game controls work before delayed models finish, then the same canvas renders the game scene', async ({ page }) => {
  await page.addInitScript(() => {
    let drawCalls = 0;
    const originalElements = WebGL2RenderingContext.prototype.drawElements;
    const originalArrays = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawElements = function (...args) { drawCalls++; originalElements.apply(this, args); };
    WebGL2RenderingContext.prototype.drawArrays = function (...args) { drawCalls++; originalArrays.apply(this, args); };
    (window as unknown as { __v37DrawCalls: () => number }).__v37DrawCalls = () => drawCalls;
  });
  const drawCalls = () => page.evaluate(() => (window as unknown as { __v37DrawCalls: () => number }).__v37DrawCalls());
  let releaseModels!: () => void;
  const barrier = new Promise<void>(resolve => { releaseModels = resolve; });
  await page.route(/\/models\/(?:math-world|fox-guide)\.glb$/, async route => { await barrier; await route.continue(); });
  try {
    await page.goto('/?premium3d=1');
    await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'loading');
    await page.locator('canvas.ba3d-canvas').evaluate(canvas => canvas.setAttribute('data-loading-canvas', 'yes'));
    expect(await drawCalls(), 'Do not draw incomplete models during initialization').toBe(0);
    await page.locator('.ba3d-math-quest .ba3d-play').click();
    await expect(page.locator('.quiz-question')).toBeVisible();
    expect(await drawCalls(), 'Opening a game while GLBs are pending must not start a world RAF').toBe(0);
    releaseModels();
    await ready(page);
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
    await expect(page.locator('.ba37-game-scene-slot canvas[data-loading-canvas="yes"]')).toHaveCount(1);
    await expect.poll(async () => {
      const value = await diagnostics(page);
      return { mode: value.sceneMode, world: value.gameWorld, paused: value.paused };
    }).toEqual({ mode: 'game', world: 'math-quest', paused: false });
    await expect.poll(drawCalls).toBeGreaterThan(0);
    const gameTime = (await diagnostics(page)).animationTime;
    await expect.poll(async () => (await diagnostics(page)).animationTime).toBeGreaterThan(gameTime);
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('canvas[data-loading-canvas="yes"]')).toHaveCount(1);
    await expect(page.locator('.ba37-game-scene-slot')).toHaveCount(0);
    await expect.poll(async () => (await diagnostics(page)).sceneMode).toBe('home');
  } finally { releaseModels(); }
});

test('Missing required GLB falls back to a new legacy canvas while DOM gameplay stays available', async ({ page }) => {
  await page.route('**/models/math-world.glb', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA missing model' }));
  await page.goto('/?premium3d=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
  await expect(page.locator('.ba3d-render-status')).toContainText('dự phòng');
  await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  await page.locator('.ba3d-math-quest .ba3d-play').click();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.result-next')).toBeVisible();
});

test('A real texture decode failure falls back instead of showing untextured premium models', async ({ page }) => {
  await page.addInitScript(() => {
    let rejectedTextures = 0;
    window.createImageBitmap = (async () => {
      rejectedTextures++;
      throw new DOMException('QA rejected bitmap texture decoding', 'InvalidStateError');
    }) as typeof window.createImageBitmap;
    (window as unknown as { __v37RejectedTextures: () => number }).__v37RejectedTextures = () => rejectedTextures;
  });
  await page.goto('/?premium3d=1');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
  expect(await page.evaluate(() => (window as unknown as { __v37RejectedTextures: () => number }).__v37RejectedTextures())).toBeGreaterThan(0);
  await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  await page.locator('.ba3d-math-quest .ba3d-play').click();
  await page.locator('.answer-option').first().click();
  await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
});

test('Without any WebGL context, Canvas fallback still opens all three games through DOM controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/?premium3d=1');
  await ready(page, 'canvas');
  for (const [moduleId, stage] of [['math-quest', '.quiz-question'], ['memory-match', '.memory-grid'], ['sentence-builder', '.sentence-bank']]) {
    await page.locator(`.ba3d-${moduleId} .ba3d-play`).click();
    await expect(page.locator(stage)).toBeVisible();
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('.ba3d-play')).toHaveCount(3);
  }
});

test('Actual WEBGL_lose_context replaces the premium canvas and keeps gameplay usable', async ({ page }) => {
  await page.goto('/?premium3d=1');
  await ready(page);
  const lost = await page.locator('canvas.ba3d-canvas').evaluate(canvas => {
    canvas.setAttribute('data-before-loss', 'yes');
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return !!extension;
  });
  expect(lost, 'Installed Edge must expose real context-loss testing').toBe(true);
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', /legacy-webgl2|canvas/);
  await expect(page.locator('canvas[data-before-loss]')).toHaveCount(0);
  await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
  await page.locator('.ba3d-memory-match .ba3d-play').click();
  await expect(page.locator('.memory-card')).toHaveCount(12);
});

test('Twenty home/parent transitions release canvas listeners and every renderer RAF', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const nativeRaf = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = nativeRaf(time => { pending.delete(id); callback(time); });
      pending.add(id); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id); };
    const interested = new Set(['resize', 'visibilitychange', 'webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror', 'pointerdown', 'pointerup', 'pointercancel', 'change']);
    const records: { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; capture: boolean }[] = [];
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      if (listener && interested.has(type) && !(typeof options === 'object' && options.once) && !records.some(record => record.target === this && record.type === type && record.listener === listener && record.capture === capture)) records.push({ target: this, type, listener, capture });
      nativeAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      const index = records.findIndex(record => record.target === this && record.type === type && record.listener === listener && record.capture === capture);
      if (index !== -1) records.splice(index, 1);
      nativeRemove.call(this, type, listener, options);
    };
    (window as unknown as { __v37Lifecycle: () => { pendingRaf: number; canvasListeners: number; globalListeners: number } }).__v37Lifecycle = () => ({
      pendingRaf: pending.size,
      canvasListeners: records.filter(record => record.target instanceof HTMLCanvasElement).length,
      globalListeners: records.filter(record => record.target === window || record.target === document || record.target instanceof MediaQueryList).length,
    });
  });
  const snapshot = () => page.evaluate(() => (window as unknown as { __v37Lifecycle: () => { pendingRaf: number; canvasListeners: number; globalListeners: number } }).__v37Lifecycle());
  const samples = [];
  await page.goto('/?premium3d=1');
  await ready(page);
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  await expect.poll(async () => (await snapshot()).pendingRaf).toBe(0);
  const baseline = await snapshot();
  expect(baseline.canvasListeners).toBe(0);
  for (let iteration = 0; iteration < 20; iteration++) {
    await page.getByRole('button', { name: /Thế giới game/ }).click();
    await ready(page);
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
    await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(0);
    await expect.poll(async () => (await snapshot()).pendingRaf).toBe(0);
    const sample = await snapshot(); samples.push(sample);
    expect(sample.canvasListeners, `Detached canvas listeners after transition ${iteration + 1}`).toBe(0);
    expect(sample.globalListeners, `Global listeners after transition ${iteration + 1}`).toBe(baseline.globalListeners);
  }
  await testInfo.attach('lifecycle-20-transitions', { body: JSON.stringify({ baseline, samples }, null, 2), contentType: 'application/json' });
});
