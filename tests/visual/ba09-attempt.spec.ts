import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { LearnerProfile, LearningEvent, PlaySession, QuizPack, ReviewCard } from '../../src/core/contracts';
import { BUILTIN_PACKS } from '../../src/core/seed';
import { createLearningStorageServer } from './helpers/learning-storage';

test.use({ serviceWorkers: 'block' });
const databaseName = 'bao-an-learning-v3-alpha';
const attemptStores = ['events', 'packs', 'profiles', 'reviews', 'sessions'];
type Receipt = { event: LearningEvent; review?: ReviewCard; duplicate: boolean };
type Core = { storage: Record<string, (...args: unknown[]) => Promise<unknown>> };
type Outcome<T> = { ok: true; value: T } | { ok: false; message: string; name: string };
type Snapshot = { version: number; stores: string[]; rows: Record<string, unknown[]> };
let server: Awaited<ReturnType<typeof createLearningStorageServer>>;
test.beforeAll(async () => { server = await createLearningStorageServer(path.resolve('test-results', `ba09-attempt-core-${process.pid}-${Date.now()}`)); });
test.afterAll(async () => { await server?.close(); });

async function harness(page: Page) {
  await page.goto(`${server.origin}/qa-storage`);
  await page.waitForFunction(() => !!(window as unknown as { __learningStorage?: Core }).__learningStorage);
}

async function invoke<T>(page: Page, method: string, args: unknown[] = []): Promise<Outcome<T>> {
  return page.evaluate(async ({ method, args }) => {
    const core = (window as unknown as { __learningStorage: Core }).__learningStorage;
    try { return { ok: true, value: await core.storage[method].apply(core.storage, args) }; }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error), name: error instanceof Error ? error.name : 'Error' }; }
  }, { method, args }) as Promise<Outcome<T>>;
}

async function call<T>(page: Page, method: string, args: unknown[] = []): Promise<T> {
  const result = await invoke<T>(page, method, args);
  if (!result.ok) throw new Error(`${method}: ${result.message}`);
  return result.value;
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

function packFixture(prefix: string, version = 1, itemId = `${prefix}-item`): QuizPack {
  const original = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  return { ...structuredClone(original), id: prefix, version, title: `${prefix} atomic attempt QA`, source: 'local',
    items: [{ ...original.items[0], id: itemId, objectiveId: 'ba09:objective' }, {...original.items[1],id:`${prefix}-second`,objectiveId:'ba09:objective'}] };
}

function profileFixture(profileId: string): LearnerProfile {
  return { profileId, name: 'Bảo An lượt thử QA', avatar: 'owl', grade: 3, colorTheme: 'teal',
    createdAt: '2026-10-12T08:00:00.000Z', updatedAt: '2026-10-12T08:00:00.000Z' };
}

function sessionFixture(sessionId: string, profileId: string, pack: QuizPack): PlaySession {
  return { sessionId, profileId, packId: pack.id, contentVersion: pack.version, moduleId: 'math-quest', moduleVersion: '0.2.7', status: 'active', startedAt: '2026-10-12T09:00:00.000Z' };
}

function eventFixture(session: PlaySession, pack: QuizPack, key = 'answer-1'): LearningEvent {
  return { eventId: `${session.sessionId}:${key}`, sessionId: session.sessionId, profileId: session.profileId, packId: pack.id, contentVersion: pack.version,
    moduleId: session.moduleId, moduleVersion: session.moduleVersion, itemId: pack.items[0].id, objectiveId: pack.items[0].objectiveId,
    correct: true, hintsUsed: 0, elapsedMs: 50_000, occurredAt: '2026-10-12T17:00:00.000Z' };
}

const reviewKey = (event: LearningEvent) => JSON.stringify([event.profileId ?? 'default-learner', event.packId, event.contentVersion, event.itemId]);

async function setup(page: Page, prefix: string) {
  await harness(page); await call(page, 'listProfiles');
  const profile = profileFixture(`${prefix}-learner`), pack = packFixture(`${prefix}-pack`), session = sessionFixture(`${prefix}-session`, profile.profileId, pack);
  await call(page, 'saveProfile', [profile]); await call(page, 'savePack', [pack]); await call(page, 'createSession', [session]);
  return { profile, pack, session, event: eventFixture(session, pack) };
}

test('BA09: an atomic attempt returns committed evidence; retries never advance review or replace the original clock', async ({ page }) => {
  const fixture = await setup(page, 'ba09-retry');
  const receipt = await call<Receipt>(page, 'addEvent', [fixture.event]);
  expect(receipt.duplicate).toBe(false); expect(receipt.event).toEqual(fixture.event);
  expect(receipt.review).toMatchObject({ schemaVersion: 1, cardId: reviewKey(fixture.event), contentVersion: 1, profileId: fixture.profile.profileId,
    packId: fixture.pack.id, itemId: fixture.event.itemId, evidenceKind: 'practice', repetitions: 0, intervalDays: 1, lastQuality: 4,
    lastReviewedAt: fixture.event.occurredAt, nextReviewDate: '2026-10-14' }); // The event is just after midnight in Vietnam.
  const saved = await snapshot(page), bytes = JSON.stringify(saved);
  expect(saved.rows.events).toEqual([fixture.event]); expect(saved.rows.reviews).toEqual([receipt.review]);
  const retry = await call<Receipt>(page, 'addEvent', [{ ...fixture.event, occurredAt: '2026-10-13T10:00:00.000Z', elapsedMs: 70_000 }]);
  expect(retry).toEqual({ ...receipt, duplicate: true }); expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  await call(page, 'endSession', [fixture.session.sessionId, 'completed']);
  const ended = JSON.stringify(await snapshot(page));
  expect(await call(page, 'addEvent', [fixture.event])).toEqual({ ...receipt, duplicate: true });
  expect(JSON.stringify(await snapshot(page))).toBe(ended);
});

test('BA09: a historical event retry cannot invent a missing modern review card', async ({ page }) => {
  const fixture = await setup(page, 'ba09-historical');
  await page.evaluate(async ({ name, event }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('events', 'readwrite'); tx.objectStore('events').add(event);
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { name: databaseName, event: fixture.event });
  const bytes = JSON.stringify(await snapshot(page));
  const receipt = await call<Receipt>(page, 'addEvent', [{ ...fixture.event, elapsedMs: 60_000 }]);
  expect(receipt.duplicate).toBe(true); expect(receipt.event).toEqual(fixture.event); expect(receipt.review).toBeUndefined();
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
});

test('BA09: profile, pack, version, item and objective mismatches cannot write an event or a review', async ({ page }) => {
  const fixture = await setup(page, 'ba09-metadata');
  const bytes = JSON.stringify(await snapshot(page));
  const invalid = [
    { ...fixture.event, profileId: 'default-learner' },
    { ...fixture.event, packId: 'ba09-foreign-pack' },
    { ...fixture.event, contentVersion: 2 },
    { ...fixture.event, itemId: 'ba09-foreign-item' },
    { ...fixture.event, objectiveId: 'ba09-foreign-objective' },
    { ...fixture.event, elapsedMs: -1 },
    { ...fixture.event, hintsUsed: 21 },
  ];
  for (const event of invalid) {
    expect((await invoke(page, 'addEvent', [event])).ok).toBe(false);
    expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  }
  await call(page, 'addEvent', [fixture.event]);
  const saved = JSON.stringify(await snapshot(page));
  const conflict = await invoke(page, 'addEvent', [{ ...fixture.event, profileId: 'default-learner' }]);
  expect(conflict.ok).toBe(false); expect(JSON.stringify(await snapshot(page))).toBe(saved);
});

test('BA09: shared item IDs, different content versions and colon-containing identities use distinct review tuples and retain legacy rows', async ({ page }) => {
  await harness(page); await call(page, 'listProfiles');
  const profile = profileFixture('ba09:tuple:learner');
  const colonProfiles = [profileFixture('ba09:collision:a:b'), profileFixture('ba09:collision:a')];
  for (const row of [profile, ...colonProfiles]) await call(page, 'saveProfile', [row]);
  const sharedItem = 'shared:item';
  const packs = [packFixture('ba09-tuple-pack', 1, sharedItem), packFixture('ba09-tuple-pack', 2, sharedItem), packFixture('ba09-tuple-other', 1, sharedItem),
    packFixture('ba09-colon-a', 1, 'c'), packFixture('ba09-colon-b', 1, 'b:c')];
  expect(`${colonProfiles[0].profileId}:${packs[3].items[0].id}`).toBe(`${colonProfiles[1].profileId}:${packs[4].items[0].id}`);
  for (const pack of packs) await call(page, 'savePack', [pack]);
  const legacy: ReviewCard = { cardId: `${profile.profileId}:${sharedItem}`, profileId: profile.profileId, itemId: sharedItem, packId: packs[0].id,
    repetitions: 2, intervalDays: 6, easeFactor: 2.5, lastQuality: 4, lastReviewedAt: '2026-10-06T09:00:00.000Z', nextReviewDate: '2026-10-12' };
  await call(page, 'saveReviewCard', [legacy]);
  const keys: string[] = [];
  for (const [index, pack] of packs.entries()) {
    const owner = index < 3 ? profile.profileId : colonProfiles[index - 3].profileId;
    const session = sessionFixture(`ba09-tuple-session-${index}`, owner, pack);
    await call(page, 'createSession', [session]);
    const event = eventFixture(session, pack);
    const receipt = await call<Receipt>(page, 'addEvent', [event]);
    expect(receipt.review?.cardId).toBe(reviewKey(event)); keys.push(reviewKey(event));
  }
  expect(new Set(keys).size).toBe(5);
  const saved = await snapshot(page);
  expect(saved.rows.events).toHaveLength(5); expect(saved.rows.reviews).toHaveLength(6);
  expect(saved.rows.reviews).toEqual(expect.arrayContaining([legacy, ...keys.map(cardId => expect.objectContaining({ cardId }))]));
});

test('BA09: two tabs commit distinct attempts to one review without losing evidence or independent scheduling state', async ({ page, context }) => {
  const fixture = await setup(page, 'ba09-concurrent');
  const card: ReviewCard = { cardId: reviewKey(fixture.event), schemaVersion: 1, contentVersion: 1, evidenceKind: 'independent', profileId: fixture.profile.profileId,
    packId: fixture.pack.id, itemId: fixture.event.itemId, repetitions: 2, intervalDays: 6, easeFactor: 2.5, lastQuality: 4,
    lastReviewedAt: '2026-10-06T09:00:00.000Z', nextReviewDate: '2026-10-12', lastEvidenceDay: '2026-10-06', lastEvidenceSessionId: 'qa-independent-source' };
  await call(page, 'saveReviewCard', [card]);
  const other = await context.newPage();
  try {
    await harness(other);
    const wrong = { ...fixture.event, eventId: `${fixture.session.sessionId}:wrong-1`, correct: false, hintsUsed: 1 };
    const corrected = { ...fixture.event, eventId: `${fixture.session.sessionId}:correct-2`, occurredAt: '2026-10-12T17:00:01.000Z' };
    const receipts = await Promise.all([call<Receipt>(page, 'addEvent', [wrong]), call<Receipt>(other, 'addEvent', [corrected])]);
    expect(receipts.every(receipt => receipt.duplicate === false)).toBe(true);
    const saved = await snapshot(page);
    expect(saved.rows.events).toHaveLength(2); expect(saved.rows.events).toEqual(expect.arrayContaining([wrong, corrected]));
    expect(saved.rows.reviews).toEqual([expect.objectContaining({ cardId: card.cardId, repetitions: 2, intervalDays: 6, easeFactor: 2.5,
      lastEvidenceDay: card.lastEvidenceDay, lastEvidenceSessionId: card.lastEvidenceSessionId, lastReviewedAt: corrected.occurredAt, nextReviewDate: '2026-10-14' })]);
    const bytes = JSON.stringify(saved);
    const olderRetry = await call<Receipt>(page, 'addEvent', [wrong]);
    expect(olderRetry.duplicate).toBe(true); expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  } finally { await other.close(); }
});

/** Fail the review request after event insertion succeeds; abort the actual transaction. */
async function injectReviewFailure(page: Page, failure: 'quota' | 'constraint') {
  await page.evaluate(failure => {
    const add = IDBObjectStore.prototype.add, put = IDBObjectStore.prototype.put;
    const probe = { eventSucceeded: false, reviewSucceeded: false, aborted: false, stores: [] as string[], eventIds: [] as string[] };
    IDBObjectStore.prototype.add = function (value, key) {
      const request = add.call(this, value, key);
      if (this.name === 'events') {
        probe.eventIds.push((value as LearningEvent).eventId);
        probe.stores = Array.from(this.transaction.objectStoreNames);
        this.transaction.addEventListener('abort', () => { probe.aborted = true; });
        request.addEventListener('success', () => { probe.eventSucceeded = true; });
      }
      return request;
    };
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if (this.name === 'reviews') {
        const tx = this.transaction, store = this;
        IDBObjectStore.prototype.add = add; IDBObjectStore.prototype.put = put;
        request.addEventListener('success', () => {
          probe.reviewSucceeded = true;
          if (failure === 'constraint') {
            const duplicate = add.call(store, value, key);
            duplicate.onerror = () => {
              Object.defineProperty(request, 'error', { configurable: true, value: duplicate.error });
              request.dispatchEvent(new Event('error'));
            };
          } else {
            Object.defineProperty(request, 'error', { configurable: true, value: new DOMException('QA review quota failure', 'QuotaExceededError') });
            request.dispatchEvent(new Event('error')); tx.abort();
          }
        });
      }
      return request;
    };
    (window as unknown as { __attemptRollback: typeof probe }).__attemptRollback = probe;
  }, failure);
}

for (const failure of ['quota', 'constraint'] as const) {
  test(`BA09: a review ${failure} failure rolls back the event and review together; the same logical submission can retry`, async ({ page }) => {
    const fixture = await setup(page, `ba09-rollback-${failure}`);
    await call(page, 'addEvent', [fixture.event]);
    const second = { ...fixture.event, eventId: `${fixture.session.sessionId}:answer-2`, occurredAt: '2026-10-13T09:00:00.000Z' };
    const bytes = JSON.stringify(await snapshot(page));
    await injectReviewFailure(page, failure);
    const rejected = await invoke(page, 'addEvent', [second]); expect(rejected.ok).toBe(false);
    const probe = await page.evaluate(() => (window as unknown as { __attemptRollback: { eventSucceeded: boolean; reviewSucceeded: boolean; aborted: boolean; stores: string[] } }).__attemptRollback);
    expect(probe.eventSucceeded).toBe(true); expect(probe.reviewSucceeded).toBe(true); expect(probe.aborted).toBe(true); expect(probe.stores).toEqual(attemptStores);
    expect(JSON.stringify(await snapshot(page))).toBe(bytes);
    const receipt = await call<Receipt>(page, 'addEvent', [second]);
    expect(receipt.duplicate).toBe(false); expect(receipt.event).toEqual(second);
    const saved = await snapshot(page); expect(saved.rows.events).toHaveLength(2); expect(saved.rows.reviews).toHaveLength(1);
    const after = JSON.stringify(saved);
    expect((await call<Receipt>(page, 'addEvent', [second])).duplicate).toBe(true);
    expect(JSON.stringify(await snapshot(page))).toBe(after);
  });
}

test('BA09: a review failure remains visible in the real game UI; retry keeps the logical attempt and commits one event and one card', async ({ page }) => {
  await page.goto(server.origin+'/?view=games&controls=1');
  const pack = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  await page.getByRole('button', { name: 'Chọn Đảo Toán Học', exact: true }).click();
  await page.locator('#ba3d-pack-math-quest').selectOption(`${pack.id}@${pack.version}`);
  await page.locator('.ba3d-math-quest .ba3d-play').click();
  await expect(page.locator('.quiz-question')).toHaveText(pack.items[0].prompt);
  const before = await snapshot(page);
  await injectReviewFailure(page, 'quota');
  await page.locator('.answer-option').nth(pack.items[0].correctIndex).click();
  await expect(page.locator('.math-panel [role="alert"]')).toContainText('Chưa lưu được lượt này');
  await expect(page.locator('.answer-feedback')).toHaveCount(0); await expect(page.locator('.result-next')).toHaveCount(0);
  expect((await snapshot(page)).rows).toEqual(before.rows);
  const failed = await page.evaluate(() => (window as unknown as { __attemptRollback: { eventIds: string[]; eventSucceeded: boolean; reviewSucceeded: boolean; aborted: boolean } }).__attemptRollback);
  expect(failed.eventSucceeded).toBe(true); expect(failed.reviewSucceeded).toBe(true); expect(failed.aborted).toBe(true); expect(failed.eventIds).toHaveLength(1);
  await page.locator('.math-panel [role="alert"]').getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.locator('.answer-option').nth(pack.items[0].correctIndex).click();
  await expect(page.locator('.answer-feedback')).toContainText('Chính xác');
  const saved = await snapshot(page);
  expect(saved.rows.events).toHaveLength(1); expect(saved.rows.reviews).toHaveLength(1);
  const event = saved.rows.events[0] as LearningEvent;
  expect(event.eventId).toBe(failed.eventIds[0]);
  expect(saved.rows.reviews).toEqual([expect.objectContaining({ cardId: reviewKey(event), lastReviewedAt: event.occurredAt, repetitions: 0, evidenceKind: 'practice' })]);
  await page.getByRole('button', { name: /Thoát trò chơi/ }).click();
  await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
});
