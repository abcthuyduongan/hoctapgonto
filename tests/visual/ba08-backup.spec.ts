import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { LearningBackup } from '../../src/core/backup-io';
import { parseLearningBackup, validateLearningBackup } from '../../src/core/backup-io';
import { rebuildLessonProgress, totalRewardStars } from '../../src/core/curriculum';
import type { LearnerProfile, PlaySession, ReviewCard } from '../../src/core/contracts';
import { BUILTIN_PACKS } from '../../src/core/seed';
import { createLearningStorageServer } from './helpers/learning-storage';
import { assessmentEvidence, learningStorageFixture, reviewEvidence } from './helpers/learning-storage-fixture';

test.use({ serviceWorkers: 'block' });
const databaseName = 'bao-an-learning-v3-alpha';
const allStores = ['curricula', 'events', 'lessonProgress', 'packs', 'profiles', 'reviews', 'sessionResults', 'sessions'];
type Snapshot = { version: number; stores: string[]; rows: Record<string, unknown[]> };
let server: Awaited<ReturnType<typeof createLearningStorageServer>>;
const section = (page: Page) => page.getByRole('region', { name: 'Sao lưu hồ sơ học tập' });
const restore = (page: Page) => page.getByRole('button', { name: 'Thêm hồ sơ vào thiết bị' });

test.beforeAll(async () => { server = await createLearningStorageServer(path.resolve('test-results', `ba08-backup-core-${process.pid}-${Date.now()}`)); });
test.afterAll(async () => { await server?.close(); });

function threeStarBackup(prefix: string): LearningBackup {
  const fixture = learningStorageFixture(prefix, 'default-learner');
  const assessment = assessmentEvidence(fixture), review = reviewEvidence(fixture, assessment);
  const results = [fixture.result, assessment.result, review.result];
  const card: ReviewCard = { cardId: `default-learner:${fixture.pack.items[0].id}`, profileId: 'default-learner', itemId: fixture.pack.items[0].id, packId: fixture.pack.id,
    repetitions: 2, intervalDays: 3, easeFactor: 2.6, lastQuality: 5, lastReviewedAt: review.result.completedAt, nextReviewDate: '2026-10-16' };
  return validateLearningBackup({ schema: 'baoan-learning-backup', formatVersion: 2, exportedAt: '2026-10-14T10:00:00.000Z',
    packs: [fixture.pack], profiles: [fixture.profile], curricula: [fixture.curriculum], sessions: [fixture.session, assessment.session, review.session],
    events: [...fixture.events, ...assessment.events, ...review.events], sessionResults: results, lessonProgress: rebuildLessonProgress(results, [fixture.curriculum]), reviews: [card] });
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(async name => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Snapshot>((resolve, reject) => {
        const stores = Array.from(db.objectStoreNames), tx = db.transaction(stores, 'readonly');
        const reads = Object.fromEntries(stores.map(name => [name, tx.objectStore(name).getAll()]));
        tx.oncomplete = () => resolve({ version: db.version, stores, rows: Object.fromEntries(stores.map(name => [name, reads[name].result])) });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, databaseName);
}

async function parent(page: Page) {
  await page.goto(server.origin+'/?view=games');
  await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  await expect(section(page)).toBeVisible();
}

async function select(page: Page, backup: LearningBackup) {
  await page.getByLabel('Chọn tệp hồ sơ học tập').setInputFiles({ name: 'qa-three-stars-eight-stores.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('button', { name: 'Hủy xem trước' })).toBeVisible();
}

test('BA08: full eight-store backup restores three stars and source evidence into an untouched default seed, then downloads and reimports once', async ({ page }) => {
  const backup = threeStarBackup('ba08-ui-full');
  await parent(page);
  const before = await snapshot(page);
  expect(before.rows.profiles).toEqual([expect.objectContaining({ profileId: 'default-learner', name: 'Bé Học Giỏi' })]);
  expect(before.rows.sessions).toEqual([]);
  await select(page, backup);
  await expect(section(page)).toContainText(/Hồ sơ khởi tạo trống.*sẽ được thay/);
  await expect(restore(page)).toBeEnabled();
  const preview = section(page).locator('tbody tr');
  await expect(preview).toHaveCount(8);
  expect(await preview.filter({ hasText: 'Kết quả' }).locator('td').allTextContents()).toEqual(['3', '0']);
  expect(await preview.filter({ hasText: 'Tiến độ' }).locator('td').allTextContents()).toEqual(['1', '0']);
  await restore(page).click();
  await expect(section(page).getByRole('status')).toContainText(/Đã khôi phục.*Đã thay hồ sơ khởi tạo trống/);
  const saved = await snapshot(page);
  expect(saved.version).toBe(4); expect(saved.stores).toEqual(allStores);
  for (const name of ['sessions', 'events', 'profiles', 'reviews', 'sessionResults', 'lessonProgress'] as const) {
    expect(saved.rows[name]).toHaveLength(backup[name].length);
    expect(saved.rows[name]).toEqual(expect.arrayContaining(backup[name]));
  }
  expect(saved.rows.packs).toEqual(backup.packs.map(pack => ({ key: `${pack.id}@${pack.version}`, pack })));
  expect(saved.rows.curricula).toEqual(backup.curricula.map(curriculum => ({ key: JSON.stringify([curriculum.curriculumId, curriculum.revision]), curriculum })));
  expect(totalRewardStars(backup.lessonProgress, 'default-learner')).toBe(3);
  expect(saved.rows.lessonProgress).toEqual([expect.objectContaining({ bestStars: 3, passed: true, sourcePassResultId: backup.sessionResults[1].resultId,
    sourceReviewResultId: backup.sessionResults[2].resultId, sourcePracticeResultIds: [backup.sessionResults[0].resultId] })]);
  expect((saved.rows.profiles[0] as LearnerProfile).learningSettings).toEqual(backup.profiles[0].learningSettings);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao hồ sơ' }).click();
  const download = await downloadPromise;
  const downloaded = parseLearningBackup(await readFile((await download.path())!, 'utf8'));
  expect(downloaded.packs).toEqual(expect.arrayContaining([...BUILTIN_PACKS, ...backup.packs]));
  for (const name of ['sessions', 'events', 'profiles', 'reviews', 'curricula', 'sessionResults', 'lessonProgress'] as const) {
    expect(downloaded[name]).toEqual(saved.rows[name].map(row => name === 'curricula' ? (row as { curriculum: unknown }).curriculum : row));
  }
  expect(totalRewardStars(downloaded.lessonProgress, 'default-learner')).toBe(3);
  const bytes = JSON.stringify(saved);
  await select(page, downloaded); await expect(restore(page)).toBeDisabled();
  await expect(section(page)).toContainText('Hồ sơ đã có đầy đủ trên thiết bị này.');
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  await page.reload(); await page.getByRole('button', { name: /Góc phụ huynh/ }).click();
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
});

for (const failure of ['quota', 'constraint'] as const) {
  test(`BA08: a late ${failure} failure after new-store writes and seed-profile replacement rolls back all eight stores`, async ({ page }) => {
    const backup = threeStarBackup(`ba08-ui-rollback-${failure}`);
    await parent(page); await select(page, backup); await expect(restore(page)).toBeEnabled();
    const bytes = JSON.stringify(await snapshot(page));
    await page.evaluate(({ failure }) => {
      const add = IDBObjectStore.prototype.add, put = IDBObjectStore.prototype.put;
      const probe = { seedProfilePutSucceeded: false, successfulEarlierStores: [] as string[], aborted: false, stores: [] as string[] };
      IDBObjectStore.prototype.put = function (value, key) {
        const request = put.call(this, value, key);
        if (this.name === 'profiles') request.addEventListener('success', () => { probe.seedProfilePutSucceeded = true; });
        return request;
      };
      IDBObjectStore.prototype.add = function (value, key) {
        const tx = this.transaction;
        probe.stores = Array.from(tx.objectStoreNames);
        tx.addEventListener('abort', () => { probe.aborted = true; });
        const request = add.call(this, value, key);
        if (this.name === 'sessionResults') {
          IDBObjectStore.prototype.add = add; IDBObjectStore.prototype.put = put;
          request.addEventListener('success', () => {
            if (failure === 'constraint') {
              const duplicate = add.call(tx.objectStore('sessionResults'), value, key);
              duplicate.onerror = () => {
                Object.defineProperty(request, 'error', { configurable: true, value: duplicate.error });
                request.dispatchEvent(new Event('error'));
              }; // Native ConstraintError retains its default transaction abort.
            }
            else {
              // Model a quota error on this request after earlier requests have
              // succeeded, then abort the real transaction. The production
              // request handler must translate the error and await rollback.
              const quota = new DOMException('QA late quota failure', 'QuotaExceededError');
              Object.defineProperty(request, 'error', { configurable: true, value: quota });
              request.dispatchEvent(new Event('error'));
              tx.abort();
            }
          });
        } else request.addEventListener('success', () => { probe.successfulEarlierStores.push(this.name); });
        return request;
      };
      (window as unknown as { __lateRestoreRollback: typeof probe }).__lateRestoreRollback = probe;
    }, { failure });
    await restore(page).click();
    await expect(section(page).getByRole('alert')).toContainText(failure === 'quota' ? /không đủ dung lượng/ : /trùng khóa/);
    const probe = await page.evaluate(() => (window as unknown as { __lateRestoreRollback: { seedProfilePutSucceeded: boolean; successfulEarlierStores: string[]; aborted: boolean; stores: string[] } }).__lateRestoreRollback);
    expect(probe.seedProfilePutSucceeded).toBe(true); expect(probe.aborted).toBe(true); expect(probe.stores).toEqual(allStores);
    expect(probe.successfulEarlierStores).toEqual(expect.arrayContaining(['packs', 'sessions', 'events', 'reviews', 'curricula']));
    expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  });
}

test('BA08: history added in another tab after preview prevents replacement of the formerly empty seeded learner', async ({ page, context }) => {
  const backup = threeStarBackup('ba08-ui-seed-race');
  await parent(page); await select(page, backup); await expect(restore(page)).toBeEnabled();
  const other = await context.newPage();
  try {
    await other.goto(`${server.origin}/qa-storage`);
    await other.waitForFunction(() => !!(window as unknown as { __learningStorage?: unknown }).__learningStorage);
    const pack = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure')!;
    const session: PlaySession = { sessionId: 'ba08-seed-touched-history', profileId: 'default-learner', packId: pack.id, contentVersion: pack.version, moduleId: 'math-quest',
      moduleVersion: '0.2.7', status: 'active', startedAt: '2026-10-14T08:00:00.000Z' };
    await other.evaluate(async session => {
      const core = (window as unknown as { __learningStorage: { storage: { createSession: (session: PlaySession) => Promise<void>; endSession: (id: string, status: 'abandoned') => Promise<void> } } }).__learningStorage;
      await core.storage.createSession(session);
      await core.storage.endSession(session.sessionId, 'abandoned');
    }, session);
    const bytes = JSON.stringify(await snapshot(page));
    await restore(page).click();
    await expect(section(page).getByRole('alert')).toContainText(/trùng khóa.*khác nội dung.*profiles.*default-learner/);
    expect(JSON.stringify(await snapshot(page))).toBe(bytes);
    expect((await snapshot(page)).rows.profiles).toEqual([expect.objectContaining({ profileId: 'default-learner', name: 'Bé Học Giỏi' })]);
  } finally { await other.close(); }
});
