import { expect, test, type Page } from '@playwright/test';
import { BUILTIN_PACKS } from '../../src/core/seed';
import type { QuizPack } from '../../src/core/contracts';

test.use({ serviceWorkers: 'block' });
const ids = ['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail'];
const stages = ['.quiz-question', '.memory-grid', '.sentence-bank', '.connect-board', '.trail-bank'];
const diagnostics = (page: Page) => page.locator('.ba3d-render-host').evaluate(host => JSON.parse((host as HTMLElement).dataset.diagnostics || '{}'));

test('The default character world opens every game with arrows and Enter without exposing selection panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.ba3d-island-picker, .game-hub-bottom')).toHaveCount(0);
  const canvas = page.getByRole('img', { name: /Điều khiển Cáo trong thế giới game/ });
  for (const [index, id] of ids.entries()) {
    await canvas.focus(); await page.keyboard.press('ArrowRight');
    await expect.poll(async () => {
      const value = await diagnostics(page);
      return { selected: value.selectedWorld, moving: value.carouselMoving, landed: value.mascotLocation };
    }).toEqual({ selected: id, moving: false, landed: id });
    await page.keyboard.press('Enter');
    await expect(page.locator('.immersive-dialog')).toBeVisible();
    await expect(page.locator(stages[index])).toBeVisible();
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(page.locator('.immersive-dialog')).toHaveCount(0);
    await expect(canvas).toBeFocused();
    await expect(page.locator('.ba3d-island-picker, .game-hub-bottom')).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await diagnostics(page)).mascotLocation).toBe('waiting');
});

test('Production mesh clicks select an island, wait for the fox, then enter through the island or the fox', async ({ page }, testInfo) => {
  let moduleUrl = '';
  page.on('response', response => { if (/\/assets\/PremiumWorldRenderer-[^/]+\.js(?:\?|$)/.test(response.url())) moduleUrl = response.url(); });
  await page.goto('/');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  expect(moduleUrl).not.toBe('');
  await page.getByRole('button', { name: 'Góc phụ huynh', exact: true }).click();
  await expect(page.locator('.ba3d-render-host')).toHaveCount(0);
  // This harness imports the actual observed production chunk and sends native
  // pointer input to its canvas. It never invokes the callbacks to simulate hits.
  await page.evaluate(async url => {
    const exports = await import(url);
    const { createPremiumRenderer } = exports.createPremiumRenderer ? exports
      : Object.values(exports).find((value: any) => typeof value?.createPremiumRenderer === 'function') as any;
    const canvas = document.createElement('canvas'); canvas.tabIndex = 0;
    canvas.style.cssText = 'position:fixed;left:160px;top:140px;width:720px;height:540px;z-index:100;background:#d8eeed';
    document.body.append(canvas);
    const selected: string[] = [], entered: string[] = [], controller = new AbortController();
    const renderer = await createPremiumRenderer({ canvas, signal: controller.signal, quality: 'low', motionOn: true, paused: false,
      onSelect(id: string) { selected.push(id); }, onEnterWorld(id: string) { entered.push(id); }, onContextLost() {} });
    const classify = (node: any): string | null => {
      for (let current = node; current; current = current.parent) {
        if (current === renderer.guideAnchor) return 'fox';
        if (current.userData.worldId) return current.userData.worldId;
      }
      return null;
    };
    const visible = (node: any) => {
      for (let current = node; current; current = current.parent) if (!current.visible) return false;
      return true;
    };
    const pointFor = (target: string) => {
      const root = target === 'fox' ? renderer.guideAnchor : renderer.world.worlds.get(target);
      renderer.world.scene.updateMatrixWorld(true); renderer.camera.updateMatrixWorld(true);
      const candidates: any[] = [];
      root.traverse((node: any) => {
        if (!node.isMesh || !visible(node)) return;
        if (node.isSkinnedMesh) node.computeBoundingSphere();
        else node.geometry.computeBoundingSphere();
        const sphere = node.isSkinnedMesh ? node.boundingSphere : node.geometry.boundingSphere;
        if (sphere) candidates.push(sphere.center.clone().applyMatrix4(node.matrixWorld).project(renderer.camera));
      });
      const roots = [...renderer.world.worlds.values(), renderer.guideAnchor];
      for (const ndc of candidates) {
        if (Math.abs(ndc.x) >= .96 || Math.abs(ndc.y) >= .96 || ndc.z < -1 || ndc.z > 1) continue;
        renderer.raycaster.setFromCamera(ndc, renderer.camera);
        const hit = renderer.raycaster.intersectObjects(roots, true).find((entry: any) => visible(entry.object));
        if (classify(hit?.object) !== target) continue;
        const box = canvas.getBoundingClientRect();
        return { x: box.left + (ndc.x + 1) * box.width / 2, y: box.top + (1 - ndc.y) * box.height / 2 };
      }
      throw new Error(`No visible mesh hit for ${target}`);
    };
    (window as any).__characterEntry = { renderer, canvas, selected, entered, pointFor,
      dispose() { renderer.dispose(); controller.abort(); canvas.remove(); delete (window as any).__characterEntry; } };
  }, moduleUrl);
  const state = () => page.evaluate(() => { const h = (window as any).__characterEntry; return { selected: [...h.selected], entered: [...h.entered], stats: h.renderer.getDiagnostics() }; });
  const point = (id: string) => page.evaluate(id => (window as any).__characterEntry.pointFor(id), id);
  const click = async (id: string) => { const position = await point(id); await page.mouse.click(position.x, position.y); };
  try {
    const id = 'math-quest';
    await click(id);
    await expect.poll(async () => (await state()).selected).toEqual([id]);
    expect((await state()).entered).toEqual([]);
    await click(id); // A second tap during the jump cannot open a game early.
    expect((await state()).entered).toEqual([]);
    await expect.poll(async () => (await state()).stats.mascotState).toBe('on-island');
    await click(id);
    await expect.poll(async () => (await state()).entered).toEqual([id]);
    await click('fox');
    await expect.poll(async () => (await state()).entered).toEqual([id, id]);
    await page.evaluate(() => (window as any).__characterEntry.renderer.setPaused(true));
    await click('fox'); expect((await state()).entered).toEqual([id, id]);
    await page.evaluate(() => (window as any).__characterEntry.renderer.setPaused(false));
    const destination = await point(id);
    await page.mouse.move(destination.x, destination.y); await page.mouse.down();
    await page.mouse.move(destination.x + 24, destination.y); await page.mouse.up();
    expect((await state()).entered).toEqual([id, id]);
    const evidence = await state();
    await testInfo.attach('real-mesh-entry', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    await page.evaluate(()=>{const h=(window as any).__characterEntry;h.canvas.style.width='320px';h.canvas.style.height='640px';});
    await expect.poll(()=>page.evaluate(()=>{const h=(window as any).__characterEntry,r=h.renderer;return Math.abs(r.camera.aspect-.5)<.001;})).toBe(true);
    const fog=await page.evaluate(()=>{const r=(window as any).__characterEntry.renderer;return {near:r.world.scene.fog.near,far:r.world.scene.fog.far,depth:r.camera.position.distanceTo(r.target)};});
    // A phone camera must not place all interactive islands past the fog's far end.
    expect(fog.depth).toBeLessThan(fog.far);expect(fog.near).toBeGreaterThan(fog.depth-10);
  } finally { await page.evaluate(() => (window as any).__characterEntry?.dispose()); }
});

test('The assistance control offers all five games when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
      return original.apply(this, [kind, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'fallback');
  await page.getByRole('button', { name: 'Mở trò chơi bằng nút', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button')).toHaveCount(5);
  for (const [index, name] of ['Đảo Toán Học', 'Khu Rừng Trí Nhớ', 'Xưởng Ghép Câu', 'Đảo Nối Từ', 'Bậc Thang Quy Luật'].entries()) {
    await page.getByRole('button', { name: `Chọn ${name}`, exact: true }).click();
    await page.locator('.ba3d-play').click(); await expect(page.locator(stages[index])).toBeVisible();
    await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  }
});

test('A parent assigns the question pack once and character entry uses that exact saved pack after reload', async ({ page }) => {
  const original = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  const pack: QuizPack = { ...structuredClone(original), id: 'qa-character-assignment', title: 'QA · Câu hỏi riêng của Bảo An', source: 'local', items: [
    { ...original.items[0], id: 'custom-entry-1', prompt: '17 + 8 = ?', options: ['24', '25', '26', '27'], correctIndex: 1, explanation: '17 + 8 = 25.' },
    { ...original.items[1], id: 'custom-entry-2', prompt: '6 × 7 = ?', options: ['41', '40', '42', '43'], correctIndex: 2, explanation: '6 × 7 = 42.' },
  ] };
  await page.goto('/');
  await page.getByRole('button', { name: 'Xưởng học liệu', exact: true }).click();
  await page.locator('details.creator-manual > summary').click();
  await page.getByLabel('Chọn tệp bộ học liệu JSON').setInputFiles({ name: 'custom-entry.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs: [pack] })) });
  await expect(page.locator('.creator-workspace [role="status"]')).toContainText('Đã nhập 1 bộ mới');
  await page.getByRole('button', { name: 'Góc phụ huynh', exact: true }).click();
  const assignment = page.getByRole('form', { name: 'Câu hỏi Đảo Toán Học', exact: true });
  await assignment.getByLabel('Bộ câu hỏi cho Đảo Toán Học', { exact: true }).selectOption(`${pack.id}@1`);
  await assignment.getByRole('button', { name: 'Lưu bộ câu hỏi cho Đảo Toán Học', exact: true }).click();
  await expect(page.locator('.parent-game-packs [role="status"]')).toContainText('Đã lưu bộ câu hỏi');
  await page.reload();
  await page.getByRole('button', { name: 'Góc phụ huynh', exact: true }).click();
  await expect(assignment.getByLabel('Bộ câu hỏi cho Đảo Toán Học', { exact: true })).toHaveValue(`${pack.id}@1`);
  await page.getByRole('button', { name: 'Thế giới game', exact: true }).click();
  const canvas = page.getByRole('img', { name: /Điều khiển Cáo trong thế giới game/ });
  await expect(page.locator('.ba3d-render-host')).toHaveAttribute('data-state', 'ready');
  await canvas.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await diagnostics(page)).mascotState).toBe('on-island');
  await page.keyboard.press('Enter');
  await expect(page.locator('.quiz-question')).toHaveText(pack.items[0].prompt);
  await expect(page.locator('.game-dialog-head h2')).toHaveText(pack.title);
  const sessions = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('bao-an-learning-v3-alpha'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise<any[]>((resolve, reject) => { const tx = db.transaction('sessions', 'readonly'), request = tx.objectStore('sessions').getAll(); tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error); }); }
    finally { db.close(); }
  });
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ packId: pack.id, contentVersion: 1, moduleId: 'math-quest', status: 'active' });
});
