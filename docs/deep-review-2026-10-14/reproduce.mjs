import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { BUILTIN_PACKS } from '../../src/core/seed.ts';
import { serializeLearningBackup } from '../../src/core/backup-io.ts';
import { processAttemptForReview } from '../../src/core/spacedRepetition.ts';
import { importRowsToQuestions } from '../../src/core/excel-import.ts';
import { carouselLayout } from '../../src/world3d/scenes/worldLayout.ts';

// Audit only: fresh browser contexts, no user browser or production data.
const baseURL = 'http://127.0.0.1:5198';
const results = {};
const math = BUILTIN_PACKS.find(p => p.id === 'math3-adventure');
const date = '2026-10-14T12:00:00.000Z';
const session = { sessionId: 'audit-session', packId: math.id, contentVersion: math.version,
  moduleId: 'math-quest', moduleVersion: '0.2.7', startedAt: date, status: 'active', profileId: 'default-learner' };
try { serializeLearningBackup({ packs: BUILTIN_PACKS, sessions: [session], events: [] }, date); }
catch (e) { results.backupWithProfile = e.message; }
try { serializeLearningBackup({ packs: BUILTIN_PACKS, sessions: [{ ...session, profileId: undefined, moduleId: 'word-connect' }].map(({ profileId, ...s }) => s), events: [] }, date); }
catch (e) { results.backupNewModule = e.message; }
const first = processAttemptForReview(undefined, 'learner', 'shared-item', 'pack-a', true, 0, 1000, new Date(date));
const second = processAttemptForReview(first, 'learner', 'shared-item', 'pack-b', true, 0, 1000, new Date(date));
results.reviewCollision = { first, second, sameCardId: first.cardId === second.cardId };
results.invalidExcelAnswer = importRowsToQuestions([
  ['2 + 2 = ?', '3', '4', '5', '6', 'Z', '2 + 2 = 4'],
  ['3 + 3 = ?', '5', '6', '7', '8', '', '3 + 3 = 6'],
], 'quiz');

const handlers = {};
const cacheRows = new Map([['./index.html', 'OLD HTML']]);
const cache = { addAll: async () => {}, match: async key => cacheRows.get(key), put: async (key, value) => cacheRows.set(key, value) };
let online = true;
vm.runInNewContext(await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8'), {
  self: { location: { origin: baseURL }, addEventListener: (name, cb) => handlers[name] = cb, skipWaiting: async () => {}, clients: { claim: async () => {} } },
  caches: { open: async () => cache, keys: async () => ['bao-an-learning-v1'], match: cache.match, delete: async () => true },
  URL, fetch: async () => { if (!online) throw new Error('offline'); return 'NEW HTML'; },
});
let navigation;
const nav = () => handlers.fetch({ request: { method: 'GET', url: baseURL + '/', mode: 'navigate' }, respondWith: promise => navigation = promise });
nav(); const networkHTML = await navigation;
online = false; nav(); const offlineHTML = await navigation;
results.swStaleNavigation = { networkHTML, offlineHTML };

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { cwd: process.cwd(), windowsHide: true, stdio: 'pipe' });
let serverLog = '';
server.stdout.on('data', b => serverLog += b); server.stderr.on('data', b => serverLog += b);
let browser;
async function stores(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('bao-an-learning-v3-alpha'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const names = [...db.objectStoreNames];
    const values = await new Promise((resolve, reject) => {
      const tx = db.transaction(names, 'readonly'); const out = {};
      for (const name of names) { const r = tx.objectStore(name).getAll(); r.onsuccess = () => out[name] = r.result; }
      tx.oncomplete = () => resolve(out); tx.onabort = () => reject(tx.error);
    });
    db.close(); return values;
  });
}
async function choose(page, id) {
  if (await page.locator(`.ba3d-${id} .ba3d-play`).count()) return;
  await page.locator('.ba3d-render-host[data-state="ready"]').waitFor();
  const box = await page.locator('canvas.ba3d-canvas').boundingBox();
  const data = await page.locator('canvas.ba3d-canvas').evaluate(c => JSON.parse(c.dataset.diagnostics));
  const layout = carouselLayout(box.width <= 700, data.islands.length);
  const span = Math.max(layout.radiusX * 2 + 4.5 * layout.frontScale, 2 * (Math.abs(layout.waiting.x) + 1.25));
  const camera = new PerspectiveCamera(32, box.width / box.height, .1, 150);
  let distance = Math.max(box.width <= 700 ? 14 : 14.5, span / (2 * Math.tan(32 * Math.PI / 360) * camera.aspect) + 3);
  const corners = [-1.25, 1.25].flatMap(x => [-.4, 2.6].flatMap(y => [-1.15, 1.15].map(z => new Vector3(layout.waiting.x + x, layout.waiting.y + y, layout.waiting.z + z))));
  for (let i = 0; i < 24; i++) {
    camera.position.set(0, distance * .38 + 1, distance); camera.lookAt(new Vector3(0, .3, 0)); camera.updateMatrixWorld();
    if (corners.every(c => { const p = c.clone().project(camera); return Math.abs(p.x) <= .94 && Math.abs(p.y) <= .94; })) break;
    distance *= 1.035;
  }
  const island = data.islands.find(i => i.id === id);
  for (const offset of [.2, 1, 1.8]) {
    const pos = new Vector3(island.x, island.y + offset * island.scale, island.z).project(camera);
    await page.mouse.click(box.x + (pos.x + 1) * box.width / 2, box.y + (1 - pos.y) * box.height / 2);
    if (await page.locator(`.ba3d-${id} .ba3d-play`).count()) return;
  }
  throw new Error('Cannot select island ' + id);
}
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(baseURL)).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error(serverLog);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(baseURL); await page.locator('.ba3d-render-host[data-state="ready"]').waitFor();
  results.initialHome = { playButtons: await page.locator('.ba3d-play').count(), canvasTabIndex: await page.locator('canvas').getAttribute('tabindex') };
  await page.screenshot({ path: fileURLToPath(new URL('./home-desktop.png', import.meta.url)), fullPage: true });
  await choose(page, 'math-quest'); await page.locator('.ba3d-math-quest .ba3d-play').click();
  await page.locator('.answer-option').nth(math.items[0].correctIndex).click();
  await page.locator('.answer-feedback').waitFor();
  results.realAttempt = await stores(page);
  const exitButton = page.getByRole('button', { name: '← Thoát trò chơi' });
  results.exitHitTest = await exitButton.evaluate(button => {
    const b = button.getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return { buttonRect: b.toJSON(), hitTag: hit?.tagName, hitClass: hit?.className, hitText: hit?.textContent, headerZ: getComputedStyle(document.querySelector('.site-header')).zIndex, overlayZ: getComputedStyle(document.querySelector('.immersive-overlay')).zIndex };
  });
  await page.screenshot({ path: fileURLToPath(new URL('./game-exit-overlap.png', import.meta.url)), fullPage: true });
  try { await exitButton.click({ timeout: 1200 }); results.exitPointerClick = 'succeeded'; }
  catch { results.exitPointerClick = 'blocked by site header; used keyboard Enter to continue the audit'; await exitButton.press('Enter'); }
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await page.getByRole('button', { name: 'Tải bản sao hồ sơ' }).click();
  await page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' }).getByRole('alert').waitFor();
  results.backupUIError = await page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' }).getByRole('alert').innerText();
  await page.getByRole('button', { name: /Thế giới game/ }).click();
  await choose(page, 'math-quest'); await page.locator('.ba3d-math-quest .ba3d-play').click();
  await page.locator('.answer-option').first().waitFor({ state: 'visible' });
  const other = await context.newPage(); await other.goto(baseURL); await other.locator('.ba3d-home').waitFor();
  results.otherTabAbandonsLive = (await stores(page)).sessions;
  await page.locator('.answer-option').nth(0).click();
  await page.locator('.math-panel .notice.error').waitFor();
  results.otherTabAttemptError = await page.locator('.math-panel .notice.error').innerText();
  await context.close();

  const unavailableContext = await browser.newContext({ serviceWorkers: 'block' });
  await unavailableContext.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  const broken = await unavailableContext.newPage(); await broken.goto(baseURL);
  await broken.locator('.ba3d-render-host[data-state="unavailable"]').waitFor();
  results.unavailableRenderer = { state: await broken.locator('.ba3d-render-host').getAttribute('data-state'), playButtons: await broken.locator('.ba3d-play').count(), message: await broken.locator('.ba3d-render-status').innerText() };
  await unavailableContext.close();

  const flowContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const flowPage = await flowContext.newPage(); await flowPage.goto(baseURL);
  const modules = [
    ['math-quest', 'math3-adventure'], ['memory-match', 'english3-family'],
    ['sentence-builder', 'english3-sentences'], ['word-connect', 'english3-family'],
    ['sequence-trail', 'logic3-sequence'],
  ];
  results.gameWalkthroughs = [];
  for (const [id, packId] of modules) {
    const pack = BUILTIN_PACKS.find(p => p.id === packId);
    await choose(flowPage, id);
    await flowPage.locator(`#ba3d-pack-${id}`).selectOption(`${packId}@1`);
    await flowPage.locator(`.ba3d-${id} .ba3d-play`).click();
    if (id === 'math-quest') {
      for (const item of pack.items) {
        await flowPage.locator('.answer-option').nth(item.correctIndex).click();
        await flowPage.locator('.answer-feedback').waitFor(); await flowPage.locator('.result-next').click();
      }
    } else if (id === 'memory-match') {
      for (const item of pack.items) {
        await flowPage.locator('.memory-card').filter({ has: flowPage.getByText(item.left, { exact: true }) }).click();
        await flowPage.locator('.memory-card').filter({ has: flowPage.getByText(item.right, { exact: true }) }).click();
      }
    } else if (id === 'word-connect') {
      await flowPage.getByRole('button', { name: `Thẻ A: ${pack.items[0].left}`, exact: true }).click();
      await flowPage.getByRole('button', { name: `Thẻ B: ${pack.items[1].right}`, exact: true }).click();
      for (const item of pack.items) {
        await flowPage.getByRole('button', { name: `Thẻ A: ${item.left}`, exact: true }).click();
        await flowPage.getByRole('button', { name: `Thẻ B: ${item.right}`, exact: true }).click();
      }
    } else {
      const sequence = id === 'sequence-trail';
      const bank = sequence ? '.trail-bank' : '.sentence-bank';
      const action = sequence ? '.trail-main-action' : '.sentence-main-action';
      const reserve = sequence ? '.trail-result-reserve' : '.sentence-result-reserve';
      for (let itemIndex = 0; itemIndex < pack.items.length; itemIndex++) {
        const item = pack.items[itemIndex];
        if (sequence && itemIndex === 0) {
          for (const i of [1, 0, 2, 3, 4]) await flowPage.locator(bank).getByRole('button', { name: item.words[i], exact: true }).click();
          await flowPage.locator(action).click(); await flowPage.locator(reserve + ' .answer-feedback').waitFor();
          await flowPage.locator(action).click();
        }
        for (const word of item.words) await flowPage.locator(bank).getByRole('button', { name: word, exact: true }).click();
        await flowPage.locator(action).click(); await flowPage.locator(reserve + ' .answer-feedback').waitFor();
        await flowPage.locator(action).click();
      }
    }
    await flowPage.locator('.reward-panel').waitFor();
    const persisted = await stores(flowPage);
    results.gameWalkthroughs.push({ moduleId: id, session: persisted.sessions.find(s => s.moduleId === id), events: persisted.events.filter(e => e.moduleId === id), activeCanvases: await flowPage.locator('canvas.ba3d-canvas').count() });
    await flowPage.locator('.reward-home').click();
    await flowPage.waitForTimeout(1100);
  }
  await flowPage.reload(); await flowPage.locator('.ba3d-home').waitFor();
  const afterReload = await stores(flowPage);
  results.walkthroughAfterReload = { completed: afterReload.sessions.filter(s => s.status === 'completed').length, events: afterReload.events.length, reviews: afterReload.reviews.length };
  await flowContext.close();

  results.mobileLayouts = [];
  for (const [width, height] of [[390, 844], [320, 640]]) {
    const mobileContext = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage(); await mobile.goto(baseURL);
    await mobile.locator('.ba3d-render-host[data-state="ready"]').waitFor();
    await mobile.screenshot({ path: fileURLToPath(new URL(`./home-${width}.png`, import.meta.url)), fullPage: true });
    const home = await mobile.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    await choose(mobile, 'word-connect'); await mobile.locator('.ba3d-word-connect .ba3d-play').click();
    await mobile.locator('.connect-board').waitFor();
    const game = await mobile.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, panel: document.querySelector('.connect-board').getBoundingClientRect().toJSON() }));
    await mobile.screenshot({ path: fileURLToPath(new URL(`./word-connect-${width}.png`, import.meta.url)), fullPage: true });
    results.mobileLayouts.push({ width, height, home, game }); await mobileContext.close();
  }

  const offlineContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const offlinePage = await offlineContext.newPage(); const errors = [];
  offlinePage.on('pageerror', e => errors.push(e.message));
  await offlinePage.goto(baseURL); await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.reload(); await offlinePage.locator('.ba3d-render-host[data-state="ready"]').waitFor();
  await choose(offlinePage, 'word-connect');
  const cacheKeys = await offlinePage.evaluate(async () => (await caches.open('bao-an-learning-v1')).keys().then(r => r.map(x => x.url)));
  await offlineContext.setOffline(true); await offlinePage.locator('.ba3d-word-connect .ba3d-play').click();
  await offlinePage.waitForTimeout(1500);
  results.unvisitedOfflineGame = { cacheKeys, errors, rootText: (await offlinePage.locator('#root').innerText()).slice(0, 400) };
  await offlinePage.screenshot({ path: fileURLToPath(new URL('./offline-game-failure.png', import.meta.url)), fullPage: true });
  await offlineContext.close();
} catch (error) { results.harnessError = { message: error.message, stack: error.stack }; }
finally {
  if (browser) await browser.close(); server.kill();
  await writeFile(new URL('./reproduction-results.json', import.meta.url), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, (key, value) => ['realAttempt', 'cacheKeys', 'first', 'second'].includes(key) ? '[see JSON evidence]' : value, 2));
}
