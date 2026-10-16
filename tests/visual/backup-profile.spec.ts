import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { LearningBackup } from '../../src/core/backup-io';
import type { ContentPack, LearnerProfile, LearningEvent, ModuleId, PairsPack, PlaySession, QuizPack, ReviewCard, SentencePack } from '../../src/core/contracts';
import { calculateReport } from '../../src/core/reports';
import { BUILTIN_PACKS } from '../../src/core/seed';
import type { CurriculumSnapshot, LessonProgress, SessionResult } from '../../src/core/learning-contracts';

type StoredProfile = {
  packs: { key: string; pack: ContentPack }[];
  sessions: PlaySession[];
  events: LearningEvent[];
  profiles: LearnerProfile[];
  reviews: ReviewCard[];
  curricula: {key: string; curriculum: CurriculumSnapshot}[];
  sessionResults: SessionResult[];
  lessonProgress: LessonProgress[];
  version: number;
  stores: string[];
};
const backupSection = (page: Page) => page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' });
const input = (page: Page) => page.getByLabel('Chọn tệp hồ sơ học tập');
const restoreButton = (page: Page) => page.getByRole('button', { name: 'Thêm hồ sơ vào thiết bị' });
test.use({ serviceWorkers: 'block' });
const sessionWithoutOwner = (session: PlaySession) => { const row = { ...session }; delete row.ownerTabId; return row; };

/** Real IndexedDB reads; no production adapter is replaced and no profile is cleared. */
async function stored(page: Page): Promise<StoredProfile> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<StoredProfile>((resolve, reject) => {
        const tx = db.transaction(['packs', 'sessions', 'events', 'profiles', 'reviews', 'curricula', 'sessionResults', 'lessonProgress'], 'readonly');
        const packs = tx.objectStore('packs').getAll();
        const sessions = tx.objectStore('sessions').getAll();
        const events = tx.objectStore('events').getAll();
        const profiles = tx.objectStore('profiles').getAll();
        const reviews = tx.objectStore('reviews').getAll();
        const curricula = tx.objectStore('curricula').getAll();
        const sessionResults = tx.objectStore('sessionResults').getAll();
        const lessonProgress = tx.objectStore('lessonProgress').getAll();
        tx.oncomplete = () => resolve({ packs: packs.result, sessions: sessions.result, events: events.result, profiles: profiles.result, reviews: reviews.result, curricula: curricula.result, sessionResults: sessionResults.result, lessonProgress: lessonProgress.result, version: db.version, stores: [...db.objectStoreNames] });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

async function parent(page: Page): Promise<void> {
  await page.goto('/?view=games&controls=1');
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(backupSection(page)).toBeVisible();
}

async function selectBackup(page: Page, backup: LearningBackup): Promise<void> {
  await input(page).setInputFiles({ name: 'qa-learning-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('button', { name: 'Hủy xem trước' })).toBeVisible();
}

async function restoreThroughUI(page: Page, backup: LearningBackup): Promise<void> {
  await selectBackup(page, backup);
  await expect(restoreButton(page)).toBeEnabled();
  await restoreButton(page).click();
  await expect(backupSection(page).getByRole('status')).toContainText('Đã khôi phục');
}

function fixture(prefix: string): LearningBackup {
  const original = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  const pack: QuizPack = { ...structuredClone(original), id: `${prefix}-quiz`, title: 'QA · Sao lưu hai câu', source: 'local', items: original.items.slice(0, 2) };
  const session: PlaySession = {
    sessionId: `${prefix}-session`, packId: pack.id, contentVersion: 1, moduleId: 'math-quest', moduleVersion: '0.2.7',
    startedAt: '2026-10-12T10:00:00.000Z', endedAt: '2026-10-12T10:01:00.000Z', status: 'completed',
    profileId: `${prefix}-learner`,
  };
  const item = pack.items[0];
  const event: LearningEvent = {
    eventId: `${session.sessionId}:answer-1`, sessionId: session.sessionId, packId: pack.id, contentVersion: 1,
    moduleId: session.moduleId, moduleVersion: session.moduleVersion, itemId: item.id, objectiveId: item.objectiveId,
    correct: true, hintsUsed: 0, elapsedMs: 2500, occurredAt: '2026-10-12T10:00:30.000Z',
    profileId: session.profileId,
  };
  const profile: LearnerProfile = { profileId: session.profileId!, name: 'Bảo An', avatar: 'owl', grade: 3,
    colorTheme: 'teal', createdAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z' };
  const review: ReviewCard = { cardId: `${profile.profileId}:${item.id}`, profileId: profile.profileId, itemId: item.id, packId: pack.id,
    repetitions: 1, intervalDays: 1, easeFactor: 2.6, lastQuality: 5, lastReviewedAt: event.occurredAt, nextReviewDate: '2026-10-13' };
  return { schema: 'baoan-learning-backup', formatVersion: 2, exportedAt: '2026-10-12T10:05:00.000Z', packs: [pack], sessions: [session], events: [event],
    profiles: [profile], reviews: [review], curricula: [], sessionResults: [], lessonProgress: [] };
}

async function writeFromOtherTab(page: Page, backup: LearningBackup): Promise<void> {
  await page.evaluate(async profile => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bao-an-learning-v3-alpha');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['packs', 'sessions', 'events', 'profiles', 'reviews'], 'readwrite');
        profile.packs.forEach(pack => tx.objectStore('packs').add({ key: `${pack.id}@${pack.version}`, pack }));
        profile.sessions.forEach(session => tx.objectStore('sessions').add(session));
        profile.events.forEach(event => tx.objectStore('events').add(event));
        profile.profiles.forEach(learner => tx.objectStore('profiles').add(learner));
        profile.reviews.forEach(card => tx.objectStore('reviews').add(card));
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, backup);
}

async function startGame(page: Page, moduleId: ModuleId, island: string, packId?: string): Promise<void> {
  await page.getByRole('button', { name: `Chọn ${island}`, exact: true }).click();
  if (packId) await page.locator(`#ba3d-pack-${moduleId}`).selectOption(`${packId}@1`);
  await page.locator(`.ba3d-${moduleId} .ba3d-play`).click();
}

async function expectPrompt(page: Page, selector: string, prompt: string): Promise<void> {
  await expect.poll(() => page.locator(selector).evaluate(element => Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? '').join('').trim())).toBe(prompt);
}

async function completeFiveGames(page: Page): Promise<void> {
  await page.goto('/?view=games&controls=1');
  const math = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  await startGame(page, 'math-quest', 'Đảo Toán Học', math.id);
  for (const item of math.items) {
    await expect(page.locator('.quiz-question')).toHaveText(item.prompt);
    await page.locator('.answer-option').nth(item.correctIndex).click();
    await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
    await page.locator('.result-next').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  const memory = BUILTIN_PACKS.find(pack => pack.id === 'english3-family') as PairsPack;
  await startGame(page, 'memory-match', 'Khu Rừng Trí Nhớ', memory.id);
  for (const item of memory.items) {
    await page.locator('.memory-card').filter({ has: page.getByText(item.left, { exact: true }) }).click();
    await page.locator('.memory-card').filter({ has: page.getByText(item.right, { exact: true }) }).click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  const sentences = BUILTIN_PACKS.find(pack => pack.id === 'english3-sentences') as SentencePack;
  await startGame(page, 'sentence-builder', 'Xưởng Ghép Câu', sentences.id);
  for (const item of sentences.items) {
    await expectPrompt(page, '.sentence-prompt', item.prompt);
    for (const word of item.words) await page.locator('.sentence-bank').getByRole('button', { name: word, exact: true }).click();
    await page.getByRole('button', { name: /Kiểm tra câu/ }).click();
    await expect(page.locator('.sentence-result-reserve')).toContainText('Chính xác');
    await page.locator('.sentence-main-action').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  await startGame(page, 'word-connect', 'Đảo Nối Từ', memory.id);
  for (const item of memory.items) {
    await page.getByRole('button', { name: `Thẻ A: ${item.left}`, exact: true }).click();
    await page.getByRole('button', { name: `Thẻ B: ${item.right}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Thẻ A: ${item.left}`, exact: true })).toBeDisabled();
  }
  await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
  const sequence = BUILTIN_PACKS.find(pack => pack.id === 'logic3-sequence') as SentencePack;
  await startGame(page, 'sequence-trail', 'Bậc Thang Quy Luật', sequence.id);
  for (const item of sequence.items) {
    await expectPrompt(page, '.trail-prompt', item.prompt);
    for (const word of item.words) await page.locator('.trail-bank').getByRole('button', { name: word, exact: true }).click();
    await page.getByRole('button', { name: /Kiểm tra quy luật/ }).click();
    await expect(page.locator('.trail-result-reserve')).toContainText('Chính xác');
    await page.locator('.trail-main-action').click();
  }
  await expect(page.locator('.reward-panel')).toBeVisible(); await page.locator('.reward-home').click();
}

test('A downloaded five-game profile restores into a fresh QA context, preserves eight stores and ignores identical reimport', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  await completeFiveGames(page);
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  const before = await stored(page);
  expect(before.sessions).toHaveLength(5); expect(before.events).toHaveLength(32);
  expect(before.profiles[0].createdAt).toBe(before.profiles[0].updatedAt);
  expect(before.sessions.every(session => session.profileId === 'default-learner' && session.ownerTabId)).toBe(true);
  const expectedReport = calculateReport(before.events, before.sessions);
  const reportText = await page.locator('.parent-stats').allTextContents();
  await page.evaluate(() => {
    const entries: { mode: IDBTransactionMode; stores: string[] }[] = [];
    const native = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (storeNames, mode, options) {
      entries.push({ mode: mode ?? 'readonly', stores: typeof storeNames === 'string' ? [storeNames] : Array.from(storeNames) });
      return native.call(this, storeNames, mode, options);
    };
    (window as unknown as { __backupTransactions: typeof entries }).__backupTransactions = entries;
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao hồ sơ' }).click();
  const download = await downloadPromise;
  const filePath = await download.path(); expect(filePath).not.toBeNull();
  const json = await readFile(filePath!, 'utf8');
  const backup = JSON.parse(json) as LearningBackup;
  expect(backup).toMatchObject({ schema: 'baoan-learning-backup', formatVersion: 2, curricula: [], sessionResults: [], lessonProgress: [] });
  expect(backup.packs).toEqual(expect.arrayContaining(BUILTIN_PACKS));
  expect(backup.sessions).toEqual(before.sessions.map(sessionWithoutOwner)); expect(backup.events).toEqual(before.events);
  expect(backup.profiles).toEqual(before.profiles); expect(backup.reviews).toEqual(before.reviews);
  const snapshotTransactions = await page.evaluate(() => (window as unknown as { __backupTransactions: { mode: string; stores: string[] }[] }).__backupTransactions);
  expect(snapshotTransactions.filter(tx => tx.mode === 'readonly' && tx.stores.length === 8)).toHaveLength(1);
  await selectBackup(page, backup); await expect(restoreButton(page)).toBeDisabled();
  expect(await stored(page)).toEqual(before);

  const freshContext = await browser.newContext({ baseURL: new URL(page.url()).origin, serviceWorkers: 'block' });
  try {
    const freshPage = await freshContext.newPage();
    await parent(freshPage);
    const freshBefore = await stored(freshPage);
    expect(freshBefore.profiles[0].createdAt).toBe(freshBefore.profiles[0].updatedAt);
    expect((await stored(freshPage)).sessions).toHaveLength(0);
    await selectBackup(freshPage, backup);
    const previewRows = backupSection(freshPage).locator('tbody tr');
    expect(await previewRows.nth(0).locator('td').allTextContents()).toEqual(['0', String(BUILTIN_PACKS.length)]);
    expect(await previewRows.nth(1).locator('td').allTextContents()).toEqual(['5', '0']);
    expect(await previewRows.nth(2).locator('td').allTextContents()).toEqual(['32', '0']);
    expect(await previewRows.nth(3).locator('td').allTextContents()).toEqual(['0', '1']);
    expect(await previewRows.nth(4).locator('td').allTextContents()).toEqual([String(before.reviews.length), '0']);
    await restoreButton(freshPage).click();
    await expect(backupSection(freshPage).getByRole('status')).toContainText('Đã khôi phục');
    const restored = await stored(freshPage);
    expect(restored.sessions).toEqual(backup.sessions); expect(restored.events).toEqual(before.events);
    expect(restored.profiles).toEqual(freshBefore.profiles); expect(restored.reviews).toEqual(before.reviews);
    expect(restored.packs).toEqual(before.packs);
    expect(restored.version).toBe(4); expect(restored.stores).toEqual(['curricula', 'events', 'lessonProgress', 'packs', 'profiles', 'reviews', 'sessionResults', 'sessions']);
    expect(calculateReport(restored.events, restored.sessions)).toEqual(expectedReport);
    expect(await freshPage.locator('.parent-stats').allTextContents()).toEqual(reportText);
    await selectBackup(freshPage, backup);
    await expect(restoreButton(freshPage)).toBeDisabled();
    await expect(backupSection(freshPage)).toContainText('Hồ sơ đã có đầy đủ trên thiết bị này.');
    expect(await previewRows.nth(0).locator('td').allTextContents()).toEqual(['0', String(BUILTIN_PACKS.length)]);
    expect(await previewRows.nth(1).locator('td').allTextContents()).toEqual(['0', '5']);
    expect(await previewRows.nth(2).locator('td').allTextContents()).toEqual(['0', '32']);
    expect(await previewRows.nth(3).locator('td').allTextContents()).toEqual(['0', '1']);
    expect(await previewRows.nth(4).locator('td').allTextContents()).toEqual(['0', String(before.reviews.length)]);
    expect(await stored(freshPage)).toEqual(restored);
    await freshPage.reload(); await freshPage.getByRole('button', { name: /Góc phụ huynh/ }).click();
    expect(await stored(freshPage)).toEqual(restored);
    await testInfo.attach('backup-round-trip', { body: JSON.stringify({ exportedRecords: { packs: backup.packs.length, sessions: backup.sessions.length, events: backup.events.length }, snapshotTransactions, report: expectedReport, restoredStores: restored.stores, restoredVersion: restored.version }, null, 2), contentType: 'application/json' });
  } finally { await freshContext.close(); }
});

test('An active backup is restored as abandoned at export time and repeated import remains idempotent', async ({ page }) => {
  await parent(page);
  const backup = fixture('qa-backup-active');
  backup.sessions[0].status = 'active'; delete backup.sessions[0].endedAt;
  await selectBackup(page, backup);
  await expect(backupSection(page)).toContainText(/1.*(?:dở dang|abandoned|đang chơi)/i);
  await restoreButton(page).click();
  await expect(backupSection(page).getByRole('status')).toContainText('Đã khôi phục');
  const saved = await stored(page);
  expect(saved.sessions[0]).toEqual({ ...backup.sessions[0], status: 'abandoned', endedAt: backup.exportedAt });
  expect(saved.events).toEqual(backup.events);
  await selectBackup(page, backup); await expect(restoreButton(page)).toBeDisabled();
  expect(await stored(page)).toEqual(saved);
});

for (const collection of ['packs', 'sessions', 'events', 'profiles', 'reviews'] as const) {
  test(`A conflicting ${collection} key is shown in preview and cannot overwrite the existing profile`, async ({ page }) => {
    await parent(page);
    const original = fixture(`qa-backup-${collection}-conflict`);
    await restoreThroughUI(page, original);
    const before = JSON.stringify(await stored(page));
    const candidate = structuredClone(original);
    let key: string;
    if (collection === 'packs') {
      candidate.packs[0].title = 'QA · Cùng khóa nhưng học liệu khác';
      key = `${candidate.packs[0].id}@${candidate.packs[0].version}`;
    } else if (collection === 'sessions') {
      candidate.sessions[0].endedAt = '2026-10-12T10:02:00.000Z';
      key = candidate.sessions[0].sessionId;
    } else if (collection === 'events') {
      candidate.events[0].correct = false;
      key = candidate.events[0].eventId;
    } else if (collection === 'profiles') {
      candidate.profiles[0].name = 'Bảo Nam'; key = candidate.profiles[0].profileId;
    } else {
      candidate.reviews[0].repetitions++; key = candidate.reviews[0].cardId;
    }
    await selectBackup(page, candidate);
    await expect(backupSection(page).getByRole('alert')).toContainText(key);
    await expect(restoreButton(page)).toBeDisabled();
    expect(JSON.stringify(await stored(page))).toBe(before);
  });
}

test('A conflict introduced by another tab after preview rejects the entire restore without changing any stored bytes', async ({ page, context }) => {
  await parent(page);
  const candidate = fixture('qa-backup-race');
  await selectBackup(page, candidate); await expect(restoreButton(page)).toBeEnabled();
  const other = await context.newPage(); await other.goto('/?view=games&controls=1');
  const changed = structuredClone(candidate); changed.events[0].correct = false;
  await writeFromOtherTab(other, changed);
  const before = await stored(page), bytes = JSON.stringify(before);
  await restoreButton(page).click();
  await expect(backupSection(page).getByRole('alert')).toContainText(/trùng khóa.*khác nội dung/);
  expect(JSON.stringify(await stored(page))).toBe(bytes);
  expect(calculateReport(before.events, before.sessions).correct).toBe(0);
});

test('A live session in another tab blocks restoration even when preview was already prepared', async ({ page, context }) => {
  await parent(page);
  const candidate = fixture('qa-backup-other-active');
  await selectBackup(page, candidate); await expect(restoreButton(page)).toBeEnabled();
  const other = await context.newPage(); await other.goto('/?view=games&controls=1');
  await startGame(other, 'math-quest', 'Đảo Toán Học');
  await other.locator('.answer-option').first().click();
  await expect(other.locator('.result-next')).toBeVisible();
  const before = JSON.stringify(await stored(page));
  await restoreButton(page).click();
  await expect(backupSection(page).getByRole('alert')).toContainText(/phiên chơi đang hoạt động/);
  expect(JSON.stringify(await stored(page))).toBe(before);
  await other.getByRole('button', { name: /Thoát trò chơi/ }).click();
});

for (const failure of ['constraint', 'quota'] as const) {
  test(`A ${failure} failure after the first write aborts the real eight-store transaction and preserves all counts and bytes`, async ({ page }, testInfo) => {
    await parent(page);
    const prior = fixture(`qa-backup-${failure}-prior`);
    await restoreThroughUI(page, prior);
    const incoming = fixture(`qa-backup-${failure}-incoming`);
    await selectBackup(page, incoming); await expect(restoreButton(page)).toBeEnabled();
    const before = await stored(page), bytes = JSON.stringify(before);
    await page.evaluate(({ failure, existing }) => {
      const native = IDBObjectStore.prototype.add;
      const probe = { writes: 0, firstSucceeded: false, aborted: false, observedStores: [] as string[] };
      IDBObjectStore.prototype.add = function (value, key) {
        if (this.transaction.mode !== 'readwrite') return native.call(this, value, key);
        probe.writes++;
        if (probe.writes === 1) {
          probe.observedStores = Array.from(this.transaction.objectStoreNames);
          this.transaction.addEventListener('abort', () => { probe.aborted = true; });
          const request = native.call(this, value, key);
          request.addEventListener('success', () => { probe.firstSucceeded = true; });
          return request;
        }
        if (probe.writes === 2) {
          IDBObjectStore.prototype.add = native;
          if (failure === 'quota') throw new DOMException('QA injected quota failure', 'QuotaExceededError');
          return native.call(this, existing);
        }
        return native.call(this, value, key);
      };
      (window as unknown as { __restoreRollback: typeof probe }).__restoreRollback = probe;
    }, { failure, existing: prior.sessions[0] });
    await restoreButton(page).click();
    await expect(backupSection(page).getByRole('alert')).toContainText(/(?:trùng khóa|không đủ dung lượng)/);
    const probe = await page.evaluate(() => (window as unknown as { __restoreRollback: { writes: number; firstSucceeded: boolean; aborted: boolean; observedStores: string[] } }).__restoreRollback);
    expect(probe.writes).toBe(2); expect(probe.aborted).toBe(true);
    if (failure === 'constraint') expect(probe.firstSucceeded).toBe(true);
    expect(probe.observedStores.sort()).toEqual(['curricula', 'events', 'lessonProgress', 'packs', 'profiles', 'reviews', 'sessionResults', 'sessions']);
    const after = await stored(page);
    expect(JSON.stringify(after)).toBe(bytes);
    await testInfo.attach(`atomic-${failure}-rollback`, { body: JSON.stringify({ probe, beforeCounts: { packs: before.packs.length, sessions: before.sessions.length, events: before.events.length }, afterCounts: { packs: after.packs.length, sessions: after.sessions.length, events: after.events.length }, exactBytesUnchanged: JSON.stringify(after) === bytes }, null, 2), contentType: 'application/json' });
  });
}

test('Invalid schema and dangling history are rejected before any database write', async ({ page }) => {
  await parent(page);
  const before = JSON.stringify(await stored(page));
  for (const value of [{ schema: 'baoan-learning-content', formatVersion: 1, packs: [] }, { ...fixture('qa-backup-invalid'), sessions: [] }]) {
    await input(page).setInputFiles({ name: 'qa-invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    await expect(backupSection(page).getByRole('alert')).toBeVisible();
    await expect(restoreButton(page)).toHaveCount(0);
    expect(JSON.stringify(await stored(page))).toBe(before);
  }
});

test('Combining valid files cannot exceed the exportable profile limits', async ({ page }) => {
  await parent(page);
  const before = JSON.stringify(await stored(page));
  const backup = fixture('qa-backup-capacity');
  const first = backup.packs[0];
  backup.packs = Array.from({ length: 500 }, (_, index) => ({ ...first, id: index === 0 ? first.id : `qa-capacity-pack-${index}` }));
  await input(page).setInputFiles({ name: 'qa-profile-capacity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(backupSection(page).getByRole('alert')).toContainText(/vượt giới hạn 500/);
  await expect(restoreButton(page)).toHaveCount(0);
  expect(JSON.stringify(await stored(page))).toBe(before);
});

test('Legacy v1 restore uses the default learner, keeps existing profiles and exports again as v2', async ({ page }) => {
  await parent(page);
  const before = await stored(page);
  const source = fixture('qa-backup-legacy');
  const legacy = { schema: source.schema, formatVersion: 1, exportedAt: source.exportedAt,
    packs: source.packs, sessions: source.sessions.map(session => { const row = { ...session }; delete row.profileId; return row; }),
    events: source.events.map(event => { const row = { ...event }; delete row.profileId; return row; }) };
  await input(page).setInputFiles({ name: 'qa-legacy-v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect(restoreButton(page)).toBeEnabled(); await restoreButton(page).click();
  await expect(backupSection(page).getByRole('status')).toContainText('Đã khôi phục');
  const after = await stored(page);
  expect(after.profiles).toEqual(before.profiles); expect(after.reviews).toEqual(before.reviews);
  expect(after.sessions).toEqual(legacy.sessions); expect(after.events).toEqual(legacy.events);
  await expect(page.locator('.parent-stats')).toContainText('1');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao hồ sơ' }).click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(await readFile((await download.path())!, 'utf8')) as LearningBackup;
  expect(downloaded.formatVersion).toBe(2); expect(downloaded.profiles).toEqual(before.profiles);
  expect(downloaded.sessions).toEqual(legacy.sessions);
  await selectBackup(page, downloaded); await expect(restoreButton(page)).toBeDisabled();
  expect(await stored(page)).toEqual(after);
});

for (const failedStore of ['profiles', 'reviews'] as const) {
  test(`A late ${failedStore} constraint rolls back successful earlier writes across all eight stores`, async ({ page }) => {
    await parent(page);
    const prior = fixture(`qa-late-${failedStore}-prior`);
    await restoreThroughUI(page, prior);
    const incoming = fixture(`qa-late-${failedStore}-incoming`);
    await selectBackup(page, incoming); await expect(restoreButton(page)).toBeEnabled();
    const before = await stored(page), bytes = JSON.stringify(before);
    await page.evaluate(({ failedStore, existing }) => {
      const native = IDBObjectStore.prototype.add;
      const probe = { earlierWritesSucceeded: 0, aborted: false, observedStores: [] as string[] };
      IDBObjectStore.prototype.add = function(value, key) {
        if (this.transaction.mode !== 'readwrite') return native.call(this, value, key);
        probe.observedStores = Array.from(this.transaction.objectStoreNames);
        this.transaction.addEventListener('abort', () => { probe.aborted = true; });
        if (this.name === failedStore) {
          IDBObjectStore.prototype.add = native;
          return native.call(this, existing);
        }
        const request = native.call(this, value, key);
        request.addEventListener('success', () => { probe.earlierWritesSucceeded++; });
        return request;
      };
      (window as unknown as { __lateRollback: typeof probe }).__lateRollback = probe;
    }, { failedStore, existing: failedStore === 'profiles' ? prior.profiles[0] : prior.reviews[0] });
    await restoreButton(page).click();
    await expect(backupSection(page).getByRole('alert')).toContainText('trùng khóa');
    const probe = await page.evaluate(() => (window as unknown as { __lateRollback: { earlierWritesSucceeded: number; aborted: boolean; observedStores: string[] } }).__lateRollback);
    expect(probe.earlierWritesSucceeded).toBeGreaterThanOrEqual(3);
    expect(probe.aborted).toBe(true); expect(probe.observedStores.sort()).toEqual(['curricula', 'events', 'lessonProgress', 'packs', 'profiles', 'reviews', 'sessionResults', 'sessions']);
    expect(JSON.stringify(await stored(page))).toBe(bytes);
  });
}

test('Snapshot export covers profile and review timestamps even when the device clock has moved backwards', async ({ page }) => {
  await parent(page);
  const candidate = fixture('qa-backup-clock');
  const future = '2027-10-14T12:00:00.000Z';
  candidate.profiles[0].updatedAt = future;
  candidate.reviews[0].lastReviewedAt = future;
  candidate.reviews[0].nextReviewDate = '2027-10-15';
  candidate.exportedAt = future;
  await restoreThroughUI(page, candidate);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao hồ sơ' }).click();
  const download = await downloadPromise;
  const result = JSON.parse(await readFile((await download.path())!, 'utf8')) as LearningBackup;
  expect(Date.parse(result.exportedAt)).toBeGreaterThanOrEqual(Date.parse(future));
  expect(result.profiles).toContainEqual(candidate.profiles[0]);
  expect(result.reviews).toContainEqual(candidate.reviews[0]);
  await selectBackup(page, result); await expect(restoreButton(page)).toBeDisabled();
});
