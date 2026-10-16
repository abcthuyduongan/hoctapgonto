import { expect, test, type Page } from '@playwright/test';
import type { LearningEvent, PlaySession, QuizPack } from '../../src/core/contracts';
import { BUILTIN_PACKS } from '../../src/core/seed';
import { GAME_REGISTRY } from '../../src/core/registry';

test.use({ serviceWorkers: 'block' });

const math = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;

async function history(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<{ sessions: PlaySession[]; events: LearningEvent[] }>((resolve, reject) => {
        const tx = db.transaction(['sessions', 'events'], 'readonly');
        const sessions = tx.objectStore('sessions').getAll();
        const events = tx.objectStore('events').getAll();
        tx.oncomplete = () => resolve({ sessions: sessions.result, events: events.result });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

async function openHome(page: Page) {
  await page.goto('/?view=games&controls=1');
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button')).toHaveCount(5);
  await expect(page.locator('.global-error')).toHaveCount(0);
}

async function openMath(page: Page) {
  await page.getByRole('button', { name: 'Chọn Đảo Toán Học', exact: true }).click();
  await page.locator('#ba3d-pack-math-quest').selectOption(`${math.id}@${math.version}`);
  await page.locator('.ba3d-math-quest .ba3d-play').click();
  await expect(page.locator('.quiz-question')).toHaveText(math.items[0].prompt);
}

async function answer(page: Page, index: number) {
  const item = math.items[index];
  await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
  await page.locator('.answer-option').nth(item.correctIndex).click();
  await expect(page.locator('.answer-feedback')).toBeVisible();
  await expect(page.locator('.math-panel [role="alert"]')).toHaveCount(0);
}

async function addSecondProfile(page: Page) {
  const opener = page.getByRole('button', { name: 'Đổi hồ sơ học sinh' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Chọn hồ sơ học sinh' });
  await dialog.getByRole('button', { name: /Thêm hồ sơ/ }).click();
  await dialog.getByRole('textbox', { name: 'Tên gọi của bé' }).fill('Bảo Nam kiểm thử');
  await dialog.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toHaveAttribute('title', 'Đang chọn: Bảo Nam kiểm thử');
}

async function addUnknownLegacySession(page: Page, sessionId: string) {
  const session: PlaySession = {
    sessionId, packId: math.id, contentVersion: math.version, moduleId: 'math-quest',
    moduleVersion: GAME_REGISTRY.find(game => game.id === 'math-quest')!.version,
    startedAt: '2026-10-12T10:00:00.000Z', status: 'active',
  };
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').add(value);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, session);
  return session;
}

test('BA-03: opening another tab and switching its profile leaves the first tab able to finish Math', async ({ page, context }) => {
  await openHome(page);
  expect(await page.evaluate(() => !!navigator.locks)).toBe(true);
  await openMath(page);
  await answer(page, 0);
  const before = await history(page);
  expect(before.sessions).toHaveLength(1);
  expect(before.events).toHaveLength(1);
  const session = before.sessions[0];
  expect(session.status).toBe('active');
  expect(session.ownerTabId).toBeTruthy();
  const tabB = await context.newPage();
  try {
    await openHome(tabB);
    expect((await history(tabB)).sessions.find(value => value.sessionId === session.sessionId)).toEqual(session);
    await addSecondProfile(tabB);
    expect((await history(tabB)).sessions.find(value => value.sessionId === session.sessionId)).toEqual(session);
    await page.locator('.result-next').click();
    for (let index = 1; index < math.items.length; index++) {
      await answer(page, index);
      await page.locator('.result-next').click();
    }
    await expect(page.locator('.reward-panel')).toBeVisible();
    const completed = await history(page);
    expect(completed.sessions).toHaveLength(1);
    expect(completed.sessions[0]).toMatchObject({ sessionId: session.sessionId, profileId: session.profileId, status: 'completed' });
    expect(completed.sessions[0].endedAt).toBeTruthy();
    expect(completed.events).toHaveLength(math.items.length);
    expect(new Set(completed.events.map(event => event.itemId))).toEqual(new Set(math.items.map(item => item.id)));
    expect(completed.events.every(event => event.profileId === session.profileId && event.sessionId === session.sessionId)).toBe(true);
    expect(completed.events.find(event => event.eventId === before.events[0].eventId)).toEqual(before.events[0]);
  } finally { await tabB.close(); }
});

test('BA-03: reloading an owned free game abandons only that orphan and preserves its committed answer', async ({ page }) => {
  await openHome(page);
  await openMath(page);
  await answer(page, 0);
  const before = await history(page);
  expect(before.sessions[0].ownerTabId).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
  await expect.poll(async () => (await history(page)).sessions[0].status).toBe('abandoned');
  const after = await history(page);
  expect(after.sessions).toHaveLength(1);
  expect(after.sessions[0]).toMatchObject({ sessionId: before.sessions[0].sessionId, profileId: before.sessions[0].profileId, status: 'abandoned' });
  expect(after.events).toEqual(before.events);
  await expect(page.getByRole('dialog', { name: /^Đang chơi / })).toHaveCount(0);
});

test('BA-03: an active legacy session without known ownership is preserved on startup', async ({ page, context }) => {
  await openHome(page);
  const legacy = await addUnknownLegacySession(page, 'ba03-unknown-legacy');
  const other = await context.newPage();
  try {
    await openHome(other);
    expect((await history(other)).sessions).toContainEqual(legacy);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
    expect((await history(page)).sessions).toContainEqual(legacy);
  } finally { await other.close(); }
});

test('BA-03: without Web Locks, another tab and reload preserve unknown and current managed sessions', async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });
  await openHome(page);
  expect(await page.evaluate(() => navigator.locks)).toBeUndefined();
  const legacy = await addUnknownLegacySession(page, 'ba03-no-locks-legacy');
  await openMath(page);
  await answer(page, 0);
  const before = await history(page);
  const managed = before.sessions.find(session => !!session.ownerTabId)!;
  expect(managed.status).toBe('active');
  const other = await context.newPage();
  try {
    await openHome(other);
    const otherHistory = await history(other);
    expect(otherHistory.sessions).toContainEqual(legacy);
    expect(otherHistory.sessions).toContainEqual(managed);
    await page.locator('.result-next').click();
    await answer(page, 1);
    const saved = await history(page);
    expect(saved.events).toHaveLength(2);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
    const after = await history(page);
    expect(after.sessions).toContainEqual(legacy);
    expect(after.sessions).toContainEqual(managed);
    expect(after.events).toEqual(saved.events);
    await expect(page.locator('.global-error')).toHaveCount(0);
  } finally { await other.close(); }
});
