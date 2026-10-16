import { expect, test, type Page } from '@playwright/test';
import type { LearningEvent, PlaySession } from '../../src/core/contracts';
import { createReleaseServer } from './helpers/offline-release';
import { advancedLearningPath } from './helpers/self-study';

test.use({ serviceWorkers: 'allow' });

const choices = [
  { id: 'math-quest', name: 'Chọn Đảo Toán Học', content: '.answer-option' },
  { id: 'memory-match', name: 'Chọn Khu Rừng Trí Nhớ', content: '.memory-card' },
  { id: 'sentence-builder', name: 'Chọn Xưởng Ghép Câu', content: '.sentence-bank button' },
  { id: 'word-connect', name: 'Chọn Đảo Nối Từ', content: '.connect-card' },
  { id: 'sequence-trail', name: 'Chọn Bậc Thang Quy Luật', content: '.trail-bank button' },
];

async function ready(page: Page) {
  await expect(page.getByRole('status', { name: 'Trạng thái ngoại tuyến' })).toContainText('Sẵn sàng học ngoại tuyến');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

async function history(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ sessions: PlaySession[]; events: LearningEvent[] }>((resolve, reject) => {
        const tx = db.transaction(['sessions', 'events'], 'readonly');
        const sessions = tx.objectStore('sessions').getAll(), events = tx.objectStore('events').getAll();
        tx.oncomplete = () => resolve({ sessions: sessions.result, events: events.result }); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

async function openGame(page: Page, choice: typeof choices[number]) {
  await page.getByRole('button', { name: choice.name, exact: true }).click();
  await page.locator(`.ba3d-${choice.id} .ba3d-play`).click();
  const dialog = page.locator(`.dialog-${choice.id}`);
  await expect(dialog.locator(choice.content).first()).toBeVisible();
  return dialog;
}

async function recordMath(page: Page) {
  const dialog = await openGame(page, choices[0]);
  await dialog.locator('.answer-option').first().click();
  await expect(dialog.locator('.answer-feedback')).toBeVisible();
  expect((await history(page)).events).toHaveLength(1);
  return dialog;
}

test('BA-05: prepared offline shell opens every unvisited game, mini-app and backup and keeps an answer', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const release = await createReleaseServer(testInfo.outputPath('releases'));
  const context = await browser.newContext({ serviceWorkers: 'allow', acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(release.origin+'/?view=games&controls=1');
    await ready(page);
    // No activity was opened while online. Every lazy resource must already be
    // in the actual worker cache before disconnecting this fresh browser.
    expect(release.served.filter(url => /\/assets\/(MathQuest|WordConnect|SequenceTrail|TimesTable|LearningProfileBackup)-/.test(url)).length).toBeGreaterThanOrEqual(5);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) if (name.startsWith('bao-an-learning-build-')) {
        for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
      }
      return urls;
    });
    for (const file of release.lazyFiles) expect(cached).toContain(`/assets/${file}`);
    expect(release.lazyFiles).toHaveLength(12);
    await context.setOffline(true);
    for (const choice of choices) {
      const dialog = await openGame(page, choice);
      if (choice.id === 'math-quest') {
        await dialog.locator('.answer-option').first().click();
        await expect(dialog.locator('.answer-feedback')).toBeVisible();
      }
      await dialog.getByRole('button', { name: /Thoát trò chơi/ }).click();
      await expect(dialog).toHaveCount(0);
    }
    await page.getByRole('button', { name: /Bảng cửu chương/ }).click();
    const mini = page.getByRole('dialog', { name: 'Bảng cửu chương tương tác' });
    await expect(mini.locator('.times-grid button')).toHaveCount(10);
    await expect(mini.locator('.loading-state')).toHaveCount(0);
    await mini.getByRole('button', { name: /Thoát ứng dụng/ }).click();
    await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
    const backup = page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' });
    await expect(backup).toBeVisible();
    const downloaded = page.waitForEvent('download');
    await backup.getByRole('button', { name: 'Tải bản sao hồ sơ', exact: true }).click();
    const download = await downloaded;
    expect(await download.failure()).toBeNull();
    await expect(backup.getByRole('alert')).toHaveCount(0);
    const saved = await history(page);
    expect(saved.sessions).toHaveLength(5);
    expect(new Set(saved.sessions.map(session => session.moduleId))).toEqual(new Set(choices.map(choice => choice.id)));
    expect(saved.events).toHaveLength(1);
    await page.reload();
    await ready(page);
    expect((await history(page)).events).toEqual(saved.events);
    await page.goto(release.origin+advancedLearningPath);
    await page.getByRole('article',{name:'Bài Vận dụng bảng nhân và chia'}).getByRole('button',{name:'Học bài này',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Các nhóm bằng nhau',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Con đã đọc xong',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Nhân và chia liên hệ với nhau',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/Tạm dừng và lưu/}).click();
    await expect(page.getByRole('button',{name:'Tiếp tục bài đang học',exact:true})).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await context.close(); await release.close(); }
});

test('BA-05: a missing lazy chunk shows an activity error and host exit plus reload recovery stay usable', async ({ browser }, testInfo) => {
  const release = await createReleaseServer(testInfo.outputPath('releases'));
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.goto(release.origin+'/?view=games&controls=1');
    const math = await recordMath(page);
    await math.getByRole('button', { name: /Thoát trò chơi/ }).click();
    const saved = await history(page);
    release.failChunk('WordConnect-');
    await page.getByRole('button', { name: choices[3].name, exact: true }).click();
    await page.locator('.ba3d-word-connect .ba3d-play').click();
    const failed = page.locator('.dialog-word-connect');
    await expect(failed).toContainText('Không tải được hoạt động');
    await expect(page.locator('#root')).not.toBeEmpty();
    await failed.getByRole('button', { name: /Thoát trò chơi/ }).click();
    await expect(failed).toHaveCount(0);
    await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
    await expect(page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' })).toBeVisible();
    await page.getByRole('button', { name: /Thế giới game/ }).click();
    await page.getByRole('button', { name: choices[3].name, exact: true }).click();
    await page.locator('.ba3d-word-connect .ba3d-play').click();
    await expect(failed).toContainText('Không tải được hoạt động');
    release.failChunk(null);
    await failed.getByRole('button', { name: 'Tải lại ứng dụng', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
    await openGame(page, choices[3]);
    expect((await history(page)).events).toEqual(saved.events);
  } finally { await context.close(); await release.close(); }
});

test('BA-05: update A to B waits for all live games and preserves old chunks, user data and unrelated caches', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const release = await createReleaseServer(testInfo.outputPath('releases'));
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const pageA = await context.newPage();
    await pageA.goto(release.origin+'/?view=games&controls=1');
    await ready(pageA);
    await pageA.evaluate(async () => {
      await (await caches.open('unrelated-user-cache')).put('/unrelated-sentinel', new Response('KEEP ME'));
      (window as unknown as { __controllerChanges: number }).__controllerChanges = 0;
      navigator.serviceWorker.addEventListener('controllerchange', () => (window as unknown as { __controllerChanges: number }).__controllerChanges++);
    });
    const gameA = await recordMath(pageA);
    const firstAnswer = (await history(pageA)).events[0];
    const pageB = await context.newPage();
    await pageB.goto(release.origin+'/?view=games&controls=1');
    await ready(pageB);
    release.switchToB();
    await pageB.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await expect.poll(() => pageB.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
    const updateA = pageA.locator('.offline-update');
    const updateB = pageB.getByRole('button', { name: 'Cập nhật ứng dụng', exact: true });
    await expect(updateA).toBeDisabled();
    await expect(updateB).toBeEnabled();
    await updateB.click();
    // Cross-tab update authorization must reject while A holds its live session.
    await pageB.waitForTimeout(750);
    expect(await pageB.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
    expect(await pageA.evaluate(() => (window as unknown as { __controllerChanges: number }).__controllerChanges)).toBe(0);
    expect((await history(pageA)).sessions[0].status).toBe('active');
    await pageA.locator('.result-next').click();
    await expect(pageA.locator('.answer-option').first()).toBeEnabled();
    await pageA.locator('.answer-option').first().click();
    await expect(pageA.locator('.answer-feedback')).toBeVisible();
    await gameA.getByRole('button', { name: /Thoát trò chơi/ }).click();
    const saved = await history(pageA);
    expect(saved.events).toHaveLength(2);
    expect(saved.events).toContainEqual(firstAnswer);
    await Promise.all([
      pageB.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      updateB.click(),
    ]);
    await ready(pageB);
    expect(await pageB.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);
    await expect(pageB.locator('.brand')).toContainText('BẢO AN QA B');
    expect((await history(pageB)).events).toEqual(saved.events);
    await context.setOffline(true);
    await pageB.reload();
    await ready(pageB);
    await expect(pageB.locator('.brand')).toContainText('BẢO AN QA B');
    const assets = await pageB.evaluate(async ({ oldChunk, model }) => {
      const hash = async (response: Response) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
      const names = await caches.keys();
      const old = await fetch(oldChunk);
      const currentModel = await fetch(model);
      return { names, oldStatus: old.status, oldHash: await hash(old), modelStatus: currentModel.status, modelHash: await hash(currentModel), sentinel: await (await (await caches.open('unrelated-user-cache')).match('/unrelated-sentinel'))?.text() };
    }, { oldChunk: release.aChunkPath, model: '/models/math-world.glb' });
    expect(assets.names.filter(name => name.startsWith('bao-an-learning-build-')).length).toBeGreaterThanOrEqual(2);
    expect(assets.sentinel).toBe('KEEP ME');
    expect(assets.oldStatus).toBe(200);
    expect(assets.oldHash).toBe(release.aChunkHash);
    expect(assets.modelStatus).toBe(200);
    expect(assets.modelHash).toBe(release.bModelHash);
    expect((await history(pageB)).events).toEqual(saved.events);
  } finally { await context.close(); await release.close(); }
});
