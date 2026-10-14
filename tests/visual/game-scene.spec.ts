import { expect, test, type Page } from '@playwright/test';
import { BUILTIN_PACKS } from '../../src/core/seed';
import type { PairsPack, QuizPack, SentencePack } from '../../src/core/contracts';

type WorldId = 'math-quest' | 'memory-match' | 'sentence-builder';
type Stats = {
  engine: string; sceneMode: 'home' | 'game'; gameWorld: WorldId | null;
  guideMood: 'idle' | 'happy' | 'encourage' | 'victory'; guideCue?: number;
  guideViewport: { x: number; y: number; width: number; height: number } | null;
  guideVisible: boolean; drawCalls: number; motion: boolean; paused: boolean;
  animationTime: number; activeClip: string; tier: string; readyAssets: string[];
};
const ids: WorldId[] = ['math-quest', 'memory-match', 'sentence-builder'];
const math = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
const memory = BUILTIN_PACKS.find(pack => pack.id === 'english3-family') as PairsPack;
const sentences = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;

async function stats(page: Page): Promise<Stats> {
  const canvas = await page.locator('canvas.ba3d-canvas').getAttribute('data-diagnostics');
  return JSON.parse(canvas ?? await page.locator('.ba3d-render-host').getAttribute('data-diagnostics') ?? '{}');
}
async function home(page: Page) {
  await page.goto('/');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-engine', 'three-webgl');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect.poll(async () => (await stats(page)).drawCalls).toBeGreaterThan(0);
}
async function open(page: Page, id: WorldId) {
  await page.locator(`.ba3d-${id} .ba3d-play`).click();
  await expect(page.locator('.immersive-dialog.premium-game')).toBeVisible();
  await expect(page.locator('.immersive-dialog')).toHaveAttribute('data-scene-engine', 'three-webgl');
  await expect(page.locator('.immersive-dialog')).toHaveAttribute('data-scene-state', 'ready');
  await expect(page.locator('.ba37-game-scene-slot canvas.ba3d-canvas')).toHaveCount(1);
  await expect.poll(async () => {
    const value = await stats(page);
    return { mode: value.sceneMode, id: value.gameWorld, paused: value.paused };
  }).toEqual({ mode: 'game', id, paused: false });
  await expect.poll(async () => (await stats(page)).guideVisible).toBe(true);
  await expect.poll(async () => (await stats(page)).drawCalls).toBeGreaterThan(0);
}
async function mood(page: Page, expected: Stats['guideMood']) {
  await expect.poll(async () => (await stats(page)).guideMood).toBe(expected);
}
const card = (page: Page, label: string) => page.locator('.memory-card').filter({ has: page.getByText(label, { exact: true }) });
const word = (page: Page, label: string) => page.locator('.sentence-bank').getByRole('button', { name: label, exact: true });

test('All games reuse the home canvas, WebGL context and decoded GLBs, including answers, quality and return home', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const known = new WeakSet<object>(); let contexts = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      const value = original.apply(this, [kind, ...args] as Parameters<typeof original>);
      if (/^(webgl2?|experimental-webgl)$/.test(kind) && value && !known.has(value)) { known.add(value); contexts++; }
      return value;
    } as typeof original;
    (window as unknown as { __gameContextCount: () => number }).__gameContextCount = () => contexts;
    const pending = new Set<number>();
    const nativeRaf = requestAnimationFrame.bind(window), nativeCancel = cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => { const id = nativeRaf(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id); };
    const interested = new Set(['resize', 'visibilitychange', 'webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror', 'pointerdown', 'pointerup', 'pointercancel', 'change']);
    const records: { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; capture: boolean }[] = [];
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      if (listener && interested.has(type) && !(typeof options === 'object' && options.once) && !records.some(record => record.target === this && record.type === type && record.listener === listener && record.capture === capture)) records.push({ target: this, type, listener, capture });
      add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      const index = records.findIndex(record => record.target === this && record.type === type && record.listener === listener && record.capture === capture);
      if (index !== -1) records.splice(index, 1);
      remove.call(this, type, listener, options);
    };
    (window as unknown as { __gameLifecycle: () => { pendingRaf: number; canvasListeners: number; globalListeners: number } }).__gameLifecycle = () => ({
      pendingRaf: pending.size,
      canvasListeners: records.filter(record => record.target instanceof HTMLCanvasElement).length,
      globalListeners: records.filter(record => record.target === window || record.target === document || record.target instanceof MediaQueryList).length,
    });
  });
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/\/models\/[^/]+\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await home(page);
  const initialRequests = [...requests];
  expect(initialRequests).toHaveLength(5);
  expect(initialRequests.map(url => new URL(url).pathname).sort()).toEqual([
    '/models/environment.glb', '/models/fox-guide.glb', '/models/language-world.glb', '/models/math-world.glb', '/models/memory-world.glb',
  ]);
  await page.locator('canvas.ba3d-canvas').evaluate(canvas => canvas.setAttribute('data-shared-scene', 'original'));
  const contextCount = () => page.evaluate(() => (window as unknown as { __gameContextCount: () => number }).__gameContextCount());
  const lifecycle = () => page.evaluate(() => (window as unknown as { __gameLifecycle: () => { pendingRaf: number; canvasListeners: number; globalListeners: number } }).__gameLifecycle());
  expect(await contextCount()).toBe(1);
  await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(1);
  const baseline = await lifecycle();
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('low');
  const snapshots = [];
  for (const id of ids) {
    await open(page, id);
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
    await expect(page.locator('.ba37-game-scene-slot canvas[data-shared-scene="original"]')).toHaveCount(1);
    await expect.poll(async () => (await stats(page)).tier).toBe('low');
    await expect(page.locator('.ba37-mascot-fallback')).toBeHidden();
    if (id === 'math-quest') await page.locator('.answer-option').nth(math.items[0].correctIndex).click();
    if (id === 'memory-match') { await card(page, memory.items[0].left).click(); await card(page, memory.items[0].right).click(); }
    if (id === 'sentence-builder') { for (const label of sentences.items[0].words) await word(page, label).click(); await page.getByRole('button', { name: /Kiểm tra câu/ }).click(); }
    await mood(page, 'happy');
    snapshots.push(await stats(page));
    expect(await contextCount()).toBe(1);
    expect(requests).toEqual(initialRequests);
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('.immersive-dialog')).toHaveCount(0);
    await expect.poll(async () => (await stats(page)).sceneMode).toBe('home');
    await expect(page.locator('canvas[data-shared-scene="original"]')).toHaveCount(1);
  }
  await page.getByLabel('Chất lượng cảnh 3D').selectOption('high');
  await open(page, 'math-quest');
  await expect.poll(async () => (await stats(page)).tier).toBe('high');
  expect(await contextCount()).toBe(1);
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  const lifecycleSamples = [];
  for (let iteration = 0; iteration < 20; iteration++) {
    const id = ids[iteration % ids.length];
    await open(page, id);
    expect((await stats(page)).guideMood, `New game ${iteration + 1} starts with a neutral guide`).toBe('idle');
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('.immersive-dialog')).toHaveCount(0);
    await expect.poll(async () => (await stats(page)).sceneMode).toBe('home');
    await expect.poll(async () => (await lifecycle()).pendingRaf).toBe(baseline.pendingRaf);
    const sample = await lifecycle(); lifecycleSamples.push(sample);
    expect(sample.canvasListeners, `Canvas listeners after open/close ${iteration + 1}`).toBe(baseline.canvasListeners);
    expect(sample.globalListeners, `Global listeners after open/close ${iteration + 1}`).toBe(baseline.globalListeners);
    expect(await contextCount()).toBe(1);
    await expect(page.locator('canvas[data-shared-scene="original"]')).toHaveCount(1);
  }
  expect(requests).toEqual(initialRequests);
  expect(errors).toEqual([]);
  await testInfo.attach('shared-game-scenes', { body: JSON.stringify({ initialRequests, contexts: await contextCount(), snapshots, lifecycleBaseline: baseline, lifecycle20OpenClose: lifecycleSamples }, null, 2), contentType: 'application/json' });
});

for (const id of ids) {
  test(`${id} shows the same guide for waiting, retry, correct and completion through real gameplay`, async ({ page }, testInfo) => {
    await home(page); await open(page, id); await mood(page, 'idle');
    const waiting = await stats(page);
    if (id === 'math-quest') {
      await page.locator('.answer-option').nth((math.items[0].correctIndex + 1) % 4).click();
      await mood(page, 'encourage'); await page.locator('.result-next').click();
      for (let index = 1; index < math.items.length; index++) {
        await expect(page.locator('.quiz-question')).toHaveText(math.items[index].prompt);
        await page.locator('.answer-option').nth(math.items[index].correctIndex).click(); await mood(page, 'happy');
        await page.locator('.result-next').click();
      }
    } else if (id === 'memory-match') {
      await card(page, memory.items[0].left).click(); await card(page, memory.items[1].left).click();
      await mood(page, 'encourage'); await expect(page.locator('.memory-card:not(:disabled)')).toHaveCount(12);
      for (let index = 0; index < memory.items.length; index++) {
        await card(page, memory.items[index].left).click(); await card(page, memory.items[index].right).click();
        await expect(page.locator('.memory-card.found')).toHaveCount((index + 1) * 2);
        if (index < memory.items.length - 1) await mood(page, 'happy');
      }
    } else {
      for (const label of [...sentences.items[0].words].reverse()) await word(page, label).click();
      await page.getByRole('button', { name: /Kiểm tra câu/ }).click(); await mood(page, 'encourage');
      await page.locator('.sentence-main-action').click();
      for (const item of sentences.items) {
        await expect(page.locator('.sentence-prompt')).toHaveText(item.prompt);
        for (const label of item.words) await word(page, label).click();
        await page.getByRole('button', { name: /Kiểm tra câu/ }).click(); await mood(page, 'happy');
        await page.locator('.sentence-main-action').click();
      }
    }
    await expect(page.locator('.reward-panel')).toBeVisible(); await mood(page, 'victory');
    const completed = await stats(page);
    expect(completed.gameWorld).toBe(id);
    expect(completed.readyAssets).toEqual(waiting.readyAssets);
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
    await testInfo.attach(`${id}-reward-live-scene`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('.reward-home').click();
    await expect.poll(async () => (await stats(page)).sceneMode).toBe('home');
  });
}

test('The live guide follows its DOM portrait window across responsive viewport changes', async ({ page }, testInfo) => {
  await home(page); await open(page, 'math-quest');
  const snapshots = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => (await stats(page)).guideViewport?.width ?? 0).toBeGreaterThan(0);
    await expect.poll(async () => {
      const value = await stats(page);
      const bounds = await page.evaluate(() => {
        const canvas = document.querySelector('canvas.ba3d-canvas')!.getBoundingClientRect();
        const guide = document.querySelector('.ba37-mascot-window')!.getBoundingClientRect();
        return { x: guide.x - canvas.x, y: guide.y - canvas.y, width: guide.width, height: guide.height };
      });
      return Math.max(...(['x', 'y', 'width', 'height'] as const).map(key => Math.abs((value.guideViewport?.[key] ?? -10000) - bounds[key])));
    }).toBeLessThanOrEqual(2);
    const value = await stats(page);
    expect(value.guideVisible).toBe(true);
    expect(value.gameWorld).toBe('math-quest');
    snapshots.push({ viewport, stats: value });
  }
  await testInfo.attach('responsive-guide-window', { body: JSON.stringify(snapshots, null, 2), contentType: 'application/json' });
});

test('Repeated correct Memory pairs replay the guide cue without recreating the scene', async ({ page }) => {
  await home(page); await open(page, 'memory-match');
  await card(page, memory.items[0].left).click(); await card(page, memory.items[0].right).click(); await mood(page, 'happy');
  const firstCue = (await stats(page)).guideCue;
  expect(typeof firstCue).toBe('number');
  await card(page, memory.items[1].left).click(); await card(page, memory.items[1].right).click();
  await expect.poll(async () => (await stats(page)).guideCue ?? -1).toBeGreaterThan(firstCue!);
  await mood(page, 'happy');
  expect((await stats(page)).activeClip).toBe('Cheer');
  await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
});

test('Hidden-document lifecycle stops the game RAF and resumes the same scene on visibility', async ({ page }) => {
  await home(page); await open(page, 'math-quest');
  // Emulate the OS visibility event deterministically; the real application
  // listener and renderer pause path run unchanged.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await stats(page)).paused).toBe(true);
  const time = (await stats(page)).animationTime;
  await page.waitForTimeout(1200);
  expect((await stats(page)).animationTime).toBe(time);
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await stats(page)).paused).toBe(false);
  await expect.poll(async () => (await stats(page)).animationTime).toBeGreaterThan(time);
  expect((await stats(page)).gameWorld).toBe('math-quest');
});

test('Reduced motion keeps a visible static game guide and feedback without a continuing RAF', async ({ page }) => {
  await page.addInitScript(() => {
    const pending = new Set<number>();
    const original = requestAnimationFrame.bind(window), cancel = cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => { const id = original(time => { pending.delete(id); callback(time); }); pending.add(id); return id; };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    (window as unknown as { __gamePendingRaf: () => number }).__gamePendingRaf = () => pending.size;
  });
  const pending = () => page.evaluate(() => (window as unknown as { __gamePendingRaf: () => number }).__gamePendingRaf());
  await page.emulateMedia({ reducedMotion: 'reduce' }); await home(page); await open(page, 'math-quest');
  await expect.poll(async () => (await stats(page)).motion).toBe(false);
  await expect.poll(pending).toBe(0);
  await page.locator('.answer-option').nth(math.items[0].correctIndex).click(); await mood(page, 'happy');
  expect((await stats(page)).guideVisible).toBe(true);
  await expect.poll(pending).toBe(0);
  const time = (await stats(page)).animationTime;
  await page.waitForTimeout(1200);
  expect((await stats(page)).animationTime).toBe(time);
  await expect(page.locator('.feedback-win')).toBeVisible();
});

test('Unavailable premium scene shows the same rendered fox fallback and all game controls remain usable', async ({ page }) => {
  await page.route('**/models/math-world.glb', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'QA unavailable model' }));
  await page.goto('/');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  for (const id of ids) {
    await page.locator(`.ba3d-${id} .ba3d-play`).click();
    await expect(page.locator('.immersive-dialog')).toBeVisible();
    const fallback = page.locator('.ba37-mascot-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('src', '/art/fox-guide-common.webp');
    await expect.poll(async () => fallback.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 640)).toBe(true);
    await expect(page.locator('canvas.ba3d-canvas')).toHaveCount(1);
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  }
});
