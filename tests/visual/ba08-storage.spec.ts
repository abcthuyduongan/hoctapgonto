import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { LearnerProfile, LearningEvent, PlaySession, QuizPack, ReviewCard } from '../../src/core/contracts';
import { BUILTIN_PACKS } from '../../src/core/seed';
import { createLearningStorageServer } from './helpers/learning-storage';
import { assessmentEvidence, learningStorageFixture } from './helpers/learning-storage-fixture';

test.use({ serviceWorkers: 'block' });

const databaseName = 'bao-an-learning-v3-alpha';
const allStores = ['curricula', 'events', 'lessonProgress', 'packs', 'profiles', 'reviews', 'sessionResults', 'sessions'];
const mutableStores = ['events', 'lessonProgress', 'profiles', 'reviews', 'sessionResults', 'sessions'];
type Rows = Record<string, unknown[]>;
type Snapshot = { version: number; stores: string[]; rows: Rows; indexes: Record<string, Record<string, { keyPath: string | string[] | null; unique: boolean }>> };
type Core = { storage: Record<string, (...args: unknown[]) => Promise<unknown>>; openLearningDatabase: () => Promise<IDBDatabase> };
type Outcome<T> = { ok: true; value: T } | { ok: false; message: string; name: string };
let server: Awaited<ReturnType<typeof createLearningStorageServer>>;

test.beforeAll(async () => {
  server = await createLearningStorageServer(path.resolve('test-results', `ba08-core-${process.pid}-${Date.now()}`));
});
test.afterAll(async () => { await server?.close(); });

async function harness(page: Page) {
  await page.goto(`${server.origin}/qa-storage`);
  await page.waitForFunction(() => !!(window as unknown as { __learningStorage?: Core }).__learningStorage);
}

async function invoke<T>(page: Page, method: string, args: unknown[] = []): Promise<Outcome<T>> {
  return page.evaluate(async ({ method, args }) => {
    const core = (window as unknown as { __learningStorage: Core }).__learningStorage;
    try {
      const fn = core.storage[method];
      if (!fn) throw new Error(`Production storage method is missing: ${method}`);
      return { ok: true, value: await fn.apply(core.storage, args) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), name: error instanceof Error ? error.name : 'Error' };
    }
  }, { method, args }) as Promise<Outcome<T>>;
}

async function call<T>(page: Page, method: string, args: unknown[] = []): Promise<T> {
  const result = await invoke<T>(page, method, args);
  if (!result.ok) throw new Error(`${method}: ${result.message}`);
  return result.value;
}

async function snapshot(page: Page, held = false): Promise<Snapshot> {
  return page.evaluate(async ({ name, held }) => {
    const db = held ? (window as unknown as { __oldConnection: IDBDatabase }).__oldConnection : await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Snapshot>((resolve, reject) => {
        const stores = Array.from(db.objectStoreNames), tx = db.transaction(stores, 'readonly');
        const reads: Record<string, IDBRequest<unknown[]>> = {};
        const indexes: Snapshot['indexes'] = {};
        stores.forEach(name => {
          const store = tx.objectStore(name);
          reads[name] = store.getAll(); indexes[name] = {};
          Array.from(store.indexNames).forEach(indexName => {
            const index = store.index(indexName);
            indexes[name][indexName] = { keyPath: index.keyPath, unique: index.unique };
          });
        });
        tx.oncomplete = () => resolve({ version: db.version, stores, indexes, rows: Object.fromEntries(stores.map(name => [name, reads[name].result])) });
        tx.onabort = () => reject(tx.error);
      });
    } finally { if (!held) db.close(); }
  }, { name: databaseName, held });
}

async function seedLegacy(page: Page, version: 1 | 3, rows: Rows) {
  await page.goto(`${server.origin}/qa-fixture`);
  await page.evaluate(async ({ name, version, rows }) => {
    const keyPaths: Record<string, string> = { packs: 'key', sessions: 'sessionId', events: 'eventId', profiles: 'profileId', reviews: 'cardId' };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => Object.keys(rows).forEach(storeName => request.result.createObjectStore(storeName, { keyPath: keyPaths[storeName] }));
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(Object.keys(rows), 'readwrite');
        Object.entries(rows).forEach(([name, records]) => records.forEach(row => tx.objectStore(name).add(row)));
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { name: databaseName, version, rows });
}

async function writeRows(page: Page, rows: Rows) {
  await page.evaluate(async ({ name, rows }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(Object.keys(rows), 'readwrite');
        Object.entries(rows).forEach(([store, records]) => records.forEach(row => tx.objectStore(store).add(row)));
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { name: databaseName, rows });
}

function legacyFixture(prefix: string, profileId?: string) {
  const builtin = BUILTIN_PACKS.find(pack => pack.id === 'math3-adventure') as QuizPack;
  const pack: QuizPack = { ...structuredClone(builtin), id: `${prefix}-pack`, title: `${prefix} legacy material`, source: 'local' };
  const session: PlaySession = { sessionId: `${prefix}-session`, packId: pack.id, contentVersion: pack.version, moduleId: 'math-quest', moduleVersion: '0.2.7',
    startedAt: '2026-10-12T10:00:00.000Z', endedAt: '2026-10-12T10:01:00.000Z', status: 'completed', ...(profileId ? { profileId } : {}) };
  const event: LearningEvent = { eventId: `${prefix}-event`, sessionId: session.sessionId, packId: pack.id, contentVersion: pack.version, moduleId: session.moduleId,
    moduleVersion: session.moduleVersion, itemId: pack.items[0].id, objectiveId: pack.items[0].objectiveId, correct: true, hintsUsed: 0, elapsedMs: 1000,
    occurredAt: '2026-10-12T10:00:30.000Z', ...(profileId ? { profileId } : {}) };
  const profile: LearnerProfile = { profileId: profileId ?? 'default-learner', name: 'Bảo An migration', avatar: 'owl', grade: 3, colorTheme: 'teal',
    createdAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z' };
  const review: ReviewCard = { cardId: `${profile.profileId}:${pack.items[0].id}`, profileId: profile.profileId, packId: pack.id, itemId: pack.items[0].id,
    repetitions: 2, intervalDays: 3, easeFactor: 2.6, lastQuality: 4, lastReviewedAt: event.occurredAt, nextReviewDate: '2026-10-15' };
  return { pack, session, event, profile, review };
}

function assertSchema(state: Snapshot) {
  expect(state.version).toBe(4); expect(state.stores).toEqual(allStores);
  for (const store of ['sessions', 'events', 'reviews']) expect(state.indexes[store].byProfile).toEqual({ keyPath: 'profileId', unique: false });
  expect(state.indexes.curricula.bySubject).toEqual({ keyPath: 'curriculum.subject', unique: false });
  expect(state.indexes.sessionResults.bySession).toEqual({ keyPath: 'sessionId', unique: true });
  expect(state.indexes.sessionResults.byProfile).toEqual({ keyPath: 'scope.profileId', unique: false });
  expect(state.indexes.sessionResults.byScope).toEqual({ keyPath: ['scope.profileId', 'scope.curriculumId', 'scope.curriculumRevision', 'scope.lessonId', 'scope.lessonRevision', 'scope.policyId', 'scope.policyRevision'], unique: false });
  expect(state.indexes.lessonProgress.byProfile).toEqual({ keyPath: 'scope.profileId', unique: false });
  expect(state.indexes.lessonProgress.byRewardGroup).toEqual({ keyPath: ['scope.profileId', 'rewardGroupId'], unique: false });
}

for (const version of [1, 3] as const) {
  test(`BA08: real DB v${version} upgrades to eight stores without rewriting legacy history or inferring stars`, async ({ page }) => {
    const fixture = legacyFixture(`ba08-v${version}`, version === 3 ? 'ba08-existing-learner' : undefined);
    const rows: Rows = { packs: [{ key: `${fixture.pack.id}@${fixture.pack.version}`, pack: fixture.pack }], sessions: [fixture.session], events: [fixture.event] };
    if (version === 3) { rows.profiles = [fixture.profile]; rows.reviews = [fixture.review]; }
    await seedLegacy(page, version, rows);
    const before = await snapshot(page);
    await page.goto(server.origin+'/?view=games&controls=1');
    await expect(page.getByRole('navigation', { name: 'Chọn đảo học tập' }).getByRole('button')).toHaveCount(5);
    await expect(page.locator('.global-error')).toHaveCount(0);
    const migrated = await snapshot(page);
    assertSchema(migrated);
    Object.keys(rows).forEach(store => expect(migrated.rows[store]).toEqual(before.rows[store]));
    expect(migrated.rows.sessionResults).toEqual([]); expect(migrated.rows.lessonProgress).toEqual([]);
    expect(migrated.rows.curricula).toEqual([]);
    if (version === 1) expect(migrated.rows.profiles).toEqual([expect.objectContaining({ profileId: 'default-learner', grade: 3 })]);
    await harness(page);
    expect(await call(page, 'listSessionResults', [fixture.profile.profileId])).toEqual([]);
    expect(await call(page, 'listLessonProgress', [fixture.profile.profileId])).toEqual([]);
    expect(await call(page, 'listSessions', [fixture.profile.profileId])).toEqual([fixture.session]);
    expect(await call(page, 'listEvents', [fixture.profile.profileId])).toEqual([fixture.event]);
    expect((await snapshot(page)).rows).toEqual(migrated.rows);
  });
}

test('BA08: deleting default learner erases its implicit legacy history and preserves other profiles and shared packs', async ({ page }) => {
  const target = legacyFixture('ba08-delete-default');
  const other = legacyFixture('ba08-delete-other', 'ba08-other-learner');
  const rows = { packs: [{ key: `${target.pack.id}@1`, pack: target.pack }, { key: `${other.pack.id}@1`, pack: other.pack }], profiles: [target.profile, other.profile],
    sessions: [target.session, other.session], events: [target.event, other.event], reviews: [target.review, other.review] };
  await seedLegacy(page, 3, rows); await harness(page); await call(page, 'listProfiles');
  const before = await snapshot(page);
  await call(page, 'deleteProfile', ['default-learner']);
  const after = await snapshot(page);
  expect(after.rows.profiles).toEqual([other.profile]); expect(after.rows.sessions).toEqual([other.session]);
  expect(after.rows.events).toEqual([other.event]); expect(after.rows.reviews).toEqual([other.review]);
  expect(after.rows.packs).toEqual(before.rows.packs); expect(after.rows.curricula).toEqual(before.rows.curricula);
  expect(after.rows.sessionResults).toEqual([]); expect(after.rows.lessonProgress).toEqual([]);
  const stale = { ...target.session, sessionId: `${target.session.sessionId}-stale`, status: 'active' }; delete stale.endedAt;
  const staleAttempt = await invoke(page, 'createSession', [stale]);
  expect(staleAttempt.ok).toBe(false); if (!staleAttempt.ok) expect(staleAttempt.message).toMatch(/hồ sơ/);
  expect((await snapshot(page)).rows).toEqual(after.rows);
  const second = await invoke(page, 'deleteProfile', [other.profile.profileId]);
  expect(second.ok).toBe(false); if (!second.ok) expect(second.message).toMatch(/ít nhất một hồ sơ/);
  expect((await snapshot(page)).rows).toEqual(after.rows);
});

async function setupLessonEvidence(page: Page, prefix: string, profileId?: string) {
  const fixture = learningStorageFixture(prefix, profileId);
  await harness(page); await call(page, 'listProfiles');
  await call(page, 'savePack', [fixture.pack]); await call(page, 'saveCurriculum', [fixture.curriculum]); await call(page, 'saveProfile', [fixture.profile]);
  // BA08 establishes storage contracts; BA09/10 implement live attempts/finalization.
  // These persisted, complete events provide real graph evidence to the adapter.
  await writeRows(page, { sessions: [fixture.session], events: fixture.events });
  return fixture;
}

test('BA08: a valid immutable result derives progress once; replay cannot rewrite evidence or award again', async ({ page }) => {
  const fixture = await setupLessonEvidence(page, 'ba08-immutable');
  await call(page, 'saveSessionResult', [fixture.result]);
  const saved = await snapshot(page); assertSchema(saved);
  expect(saved.rows.sessionResults).toEqual([fixture.result]);
  expect(saved.rows.lessonProgress).toEqual([expect.objectContaining({ scope: fixture.result.scope, rewardGroupId: fixture.result.rewardGroupId, bestStars: 1, passed: false, resultIds: [fixture.result.resultId] })]);
  const bytes = JSON.stringify(saved);
  await call(page, 'saveSessionResult', [structuredClone(fixture.result)]);
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  const changed = { ...fixture.result, completedAt: '2026-10-12T10:01:01.000Z' };
  const conflict = await invoke(page, 'saveSessionResult', [changed]);
  expect(conflict.ok).toBe(false); if (!conflict.ok) expect(conflict.message).toMatch(/kết quả.*(?:khác|chốt)/i);
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  const bypass = await writeRows(page, { sessionResults: [{ ...fixture.result, resultId: 'qa-duplicate-session-result' }] }).then(() => false, () => true);
  expect(bypass).toBe(true); // The real bySession unique index remains a hard constraint.
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  expect(await call(page, 'listLearningSessions', [fixture.profile.profileId])).toEqual([fixture.session]);
  expect(await call(page, 'listLessonEvents', [fixture.profile.profileId])).toEqual(fixture.events);
  expect(await call(page, 'listSessions', [fixture.profile.profileId])).toEqual([]);
  expect(await call(page, 'listEvents', [fixture.profile.profileId])).toEqual([]);
});

test('BA08: malformed result identity or graph evidence cannot create a result or progress row', async ({ page }) => {
  const fixture = await setupLessonEvidence(page, 'ba08-invalid-result');
  const bytes = JSON.stringify(await snapshot(page));
  const invalid = [
    { ...fixture.result, resultId: `${fixture.result.resultId}-forged` },
    { ...fixture.result, profileId: 'default-learner' },
    { ...fixture.result, scope: { ...fixture.result.scope, lessonRevision: 2 } },
    { ...fixture.result, eventIds: fixture.result.eventIds.slice(1) },
    { ...fixture.result, firstAttemptCorrect: 4 },
    { ...fixture.result, starTier: 2, passed: true, independent: true },
  ];
  for (const result of invalid) {
    const rejected = await invoke(page, 'saveSessionResult', [result]);
    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  }
});

test('BA08: creating a learning session captures committed exposure evidence and replaces empty or forged caller snapshots', async ({ page }) => {
  const fixture = await setupLessonEvidence(page, 'ba08-host-exposure');
  await call(page, 'saveSessionResult', [fixture.result]);
  const assessment = assessmentEvidence(fixture);
  const expected = { resultIds: [fixture.result.resultId], sessionIds: [fixture.session.sessionId], itemKeys: [...fixture.result.itemKeys].sort() };
  for (const forged of [false, true]) {
    const active = { ...structuredClone(assessment.session), ownerTabId:'ba08-test-owner', sessionId: `${assessment.session.sessionId}-${forged ? 'forged' : 'empty'}`, status: 'active',
      checkpoint: { ...structuredClone(assessment.session.checkpoint), receipts: [], exposedItemKeys: [], updatedAt: assessment.session.startedAt },
      exposureSources: forged
        ? { resultIds: ['result:qa-nonexistent-result'], sessionIds: ['qa-nonexistent-session'], itemKeys: [...assessment.result.itemKeys] }
        : { resultIds: [], sessionIds: [], itemKeys: [] } };
    delete active.endedAt;
    await call(page, 'createLearningSession', [active]);
    expect(await call(page, 'getLearningSession', [active.sessionId])).toEqual({ ...active, exposureSources: expected,
      checkpoint:{...active.checkpoint,stepIndex:0,readStepIds:[]} });
  }
  const before = await snapshot(page);
  const fakeCompleted = { ...structuredClone(assessment.session), sessionId: `${assessment.session.sessionId}-fake-completed`, status: 'completed',
    endedAt: assessment.session.startedAt, checkpoint: { ...structuredClone(assessment.session.checkpoint), receipts: [], exposedItemKeys: [], updatedAt: assessment.session.startedAt } };
  const rejected = await invoke(page, 'createLearningSession', [fakeCompleted]);
  expect(rejected.ok).toBe(false); if (!rejected.ok) expect(rejected.message).toMatch(/Phiên mới.*đang hoạt động/);
  expect((await snapshot(page)).rows).toEqual(before.rows);
  const pastStart = '2026-10-12T10:00:30.000Z';
  const past = { ...structuredClone(assessment.session), sessionId: `${assessment.session.sessionId}-clock-back`, status: 'active', startedAt: pastStart,
    checkpoint: { ...structuredClone(assessment.session.checkpoint), receipts: [], exposedItemKeys: [], updatedAt: pastStart },
    exposureSources: { resultIds: [], sessionIds: [], itemKeys: [] } };
  delete past.endedAt;
  const clockRejected = await invoke(page, 'createLearningSession', [past]);
  expect(clockRejected.ok).toBe(false); if (!clockRejected.ok) expect(clockRejected.message).toMatch(/Đồng hồ.*sớm hơn lịch sử/);
  expect((await snapshot(page)).rows).toEqual(before.rows);
});

test('BA08: rebuilding a forged progress cache derives its stars from immutable result evidence', async ({ page }) => {
  const fixture = await setupLessonEvidence(page, 'ba08-progress-cache');
  await call(page, 'saveSessionResult', [fixture.result]);
  const before = await snapshot(page);
  await page.evaluate(async ({ name, forged }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('lessonProgress', 'readwrite'); tx.objectStore('lessonProgress').put(forged);
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { name: databaseName, forged: { ...(before.rows.lessonProgress[0] as object), bestStars: 3, passed: true } });
  expect((await snapshot(page)).rows.lessonProgress).not.toEqual(before.rows.lessonProgress);
  await call(page, 'rebuildProgress');
  expect((await snapshot(page)).rows).toEqual(before.rows);
});

test('BA08: a newly published revision stays separate from the pinned enrollment and cannot alter existing curriculum bytes', async ({ page }) => {
  const fixture = await setupLessonEvidence(page, 'ba08-pinned');
  const before = await snapshot(page);
  await call(page, 'saveCurriculum', [structuredClone(fixture.curriculum)]);
  expect((await snapshot(page)).rows).toEqual(before.rows);
  const conflict = await invoke(page, 'saveCurriculum', [{ ...fixture.curriculum, title: 'QA rewritten published curriculum' }]);
  expect(conflict.ok).toBe(false); if (!conflict.ok) expect(conflict.message).toMatch(/lộ trình.*(?:khác|tồn tại)/i);
  expect((await snapshot(page)).rows).toEqual(before.rows);
  const revision2 = { ...structuredClone(fixture.curriculum), revision: 2 };
  await call(page, 'saveCurriculum', [revision2]);
  expect((await call<LearnerProfile[]>(page, 'listProfiles')).find(profile => profile.profileId === fixture.profile.profileId)).toEqual(fixture.profile);
  const activeStartedAt = '2026-10-12T10:04:00.000Z';
  const active = { ...structuredClone(fixture.session), ownerTabId:'ba08-test-owner', sessionId: `${fixture.session.sessionId}-active`, status: 'active', startedAt: activeStartedAt,
    checkpoint: { ...structuredClone(fixture.session.checkpoint), stepIndex: 0, readStepIds: [], receipts: [], exposedItemKeys: [], updatedAt: activeStartedAt } };
  delete active.endedAt;
  await call(page, 'createLearningSession', [active]);
  const saved = await snapshot(page);
  const mismatch = { ...structuredClone(active), sessionId: `${active.sessionId}-wrong-pin`, scope: { ...active.scope, curriculumRevision: 2 } };
  const rejected = await invoke(page, 'createLearningSession', [mismatch]);
  expect(rejected.ok).toBe(false); if (!rejected.ok) expect(rejected.message).toMatch(/(?:ghim|đăng ký|enrollment|lộ trình|phiên bản)/i);
  expect((await snapshot(page)).rows).toEqual(saved.rows);
  const legacyClose = await invoke(page, 'endSession', [active.sessionId, 'completed']);
  expect(legacyClose.ok).toBe(false); if (!legacyClose.ok) expect(legacyClose.message).toMatch(/(?:bài học|kết quả)/i);
  expect((await snapshot(page)).rows).toEqual(saved.rows);
  const appended = structuredClone(fixture.profile);
  appended.learningSettings!.enrollments.push({ ...appended.learningSettings!.enrollments[0], curriculumRevision: 2 });
  await call(page, 'saveProfile', [appended]);
  await call(page, 'saveSessionResult', [fixture.result]);
  const assessment = assessmentEvidence(fixture);
  await writeRows(page, { sessions: [assessment.session], events: assessment.events });
  await call(page, 'saveSessionResult', [assessment.result]);
  const progress = await call<{ scope: typeof fixture.result.scope; passed: boolean; bestStars: number }[]>(page, 'listLessonProgress', [fixture.profile.profileId]);
  expect(progress).toEqual([expect.objectContaining({ scope: fixture.result.scope, bestStars: 2, passed: true })]);
  const sameRewardNewScope = { ...fixture.result.scope, curriculumRevision: 2 };
  const newKey = JSON.stringify([sameRewardNewScope.profileId, sameRewardNewScope.curriculumId, sameRewardNewScope.curriculumRevision, sameRewardNewScope.lessonId,
    sameRewardNewScope.lessonRevision, sameRewardNewScope.policyId, sameRewardNewScope.policyRevision]);
  expect(await call(page, 'getLessonProgress', [newKey])).toBeUndefined();
  const pinnedHistory = await snapshot(page);
  const removed = structuredClone(appended);
  removed.learningSettings!.enrollments = removed.learningSettings!.enrollments.filter(enrollment => enrollment.curriculumRevision !== 1);
  const dropHistory = await invoke(page, 'saveProfile', [removed]);
  expect(dropHistory.ok).toBe(false); if (!dropHistory.ok) expect(dropHistory.message).toMatch(/(?:ghim|lịch sử|phiên bản|lộ trình|phiên học)/i);
  expect((await snapshot(page)).rows).toEqual(pinnedHistory.rows);
});

test('BA08: abort after result insertion rolls back both evidence and derived progress in the eight-store transaction', async ({ page }) => {
  const fixture = await setupLessonEvidence(page, 'ba08-result-rollback');
  const bytes = JSON.stringify(await snapshot(page));
  await page.evaluate(() => {
    const native = IDBObjectStore.prototype.add;
    const probe = { inserted: false, aborted: false, stores: [] as string[] };
    IDBObjectStore.prototype.add = function (value, key) {
      const request = native.call(this, value, key);
      if (this.name === 'sessionResults' && this.transaction.mode === 'readwrite') {
        IDBObjectStore.prototype.add = native;
        const tx = this.transaction; probe.stores = Array.from(tx.objectStoreNames);
        tx.addEventListener('abort', () => { probe.aborted = true; });
        request.addEventListener('success', () => { probe.inserted = true; tx.abort(); });
      }
      return request;
    };
    (window as unknown as { __resultRollback: typeof probe }).__resultRollback = probe;
  });
  const failure = await invoke(page, 'saveSessionResult', [fixture.result]);
  expect(failure.ok).toBe(false);
  const probe = await page.evaluate(() => (window as unknown as { __resultRollback: { inserted: boolean; aborted: boolean; stores: string[] } }).__resultRollback);
  expect(probe.inserted).toBe(true); expect(probe.aborted).toBe(true); expect(probe.stores).toEqual(allStores);
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  await call(page, 'saveSessionResult', [fixture.result]);
  expect((await snapshot(page)).rows.sessionResults).toEqual([fixture.result]);
});

test('BA08: deleting one learner removes learning evidence, progress and enrollment while preserving shared curriculum and another learner', async ({ page }) => {
  const target = await setupLessonEvidence(page, 'ba08-delete-learning');
  await call(page, 'saveSessionResult', [target.result]);
  const other = learningStorageFixture('ba08-keep-learning');
  await call(page, 'savePack', [other.pack]); await call(page, 'saveCurriculum', [other.curriculum]); await call(page, 'saveProfile', [other.profile]);
  await writeRows(page, { sessions: [other.session], events: other.events }); await call(page, 'saveSessionResult', [other.result]);
  const legacy = legacyFixture('ba08-delete-learning-legacy', target.profile.profileId);
  await call(page, 'savePack', [legacy.pack]);
  await writeRows(page, { sessions: [legacy.session], events: [legacy.event], reviews: [legacy.review] });
  const before = await snapshot(page);
  await call(page, 'deleteProfile', [target.profile.profileId]);
  const after = await snapshot(page);
  expect(after.rows.packs).toEqual(before.rows.packs); expect(after.rows.curricula).toEqual(before.rows.curricula);
  expect(after.rows.profiles).toEqual(before.rows.profiles.filter(row => (row as LearnerProfile).profileId !== target.profile.profileId));
  expect(after.rows.sessions).toEqual([other.session]); expect(after.rows.events).toEqual(other.events);
  expect(after.rows.sessionResults).toEqual([other.result]);
  expect(after.rows.lessonProgress).toEqual(before.rows.lessonProgress.filter(row => (row as { profileId: string }).profileId !== target.profile.profileId));
  expect(after.rows.reviews).toEqual([]);
  expect(await call(page, 'listLearningSessions', [target.profile.profileId])).toEqual([]);
  expect(await call(page, 'listLessonEvents', [target.profile.profileId])).toEqual([]);
  expect(await call(page, 'listSessionResults', [target.profile.profileId])).toEqual([]);
  expect(await call(page, 'listLessonProgress', [target.profile.profileId])).toEqual([]);
});

for (const noLocks of [false, true]) {
  test(`BA08: an active target session in another tab blocks all deletion${noLocks ? ' without Web Locks' : ''}`, async ({ page, context }) => {
    if (noLocks) await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }));
    const target = legacyFixture(`ba08-delete-live-${noLocks}`, 'ba08-live-learner');
    const other = legacyFixture(`ba08-delete-live-other-${noLocks}`, 'ba08-other-learner');
    await seedLegacy(page, 3, { packs: [{ key: `${target.pack.id}@1`, pack: target.pack }], profiles: [target.profile, other.profile], sessions: [], events: [], reviews: [] });
    await harness(page); await call(page, 'listProfiles');
    const tab = await context.newPage();
    try {
      await harness(tab);
      const active = { ...target.session, status: 'active', ownerTabId: 'ba08-live-tab' }; delete active.endedAt;
      await call(tab, 'createSession', [active]);
      const bytes = JSON.stringify(await snapshot(page));
      const outcome = await invoke(page, 'deleteProfile', [target.profile.profileId]);
      expect(outcome.ok).toBe(false); if (!outcome.ok) expect(outcome.message).toMatch(/(?:đang hoạt động|đang mở|thoát.*phiên|phiên.*hoạt động)/i);
      expect(JSON.stringify(await snapshot(page))).toBe(bytes);
      await call(tab, 'endSession', [active.sessionId, 'abandoned']);
      await call(page, 'deleteProfile', [target.profile.profileId]);
      const after = await snapshot(page); expect(after.rows.profiles).toEqual([other.profile]); expect(after.rows.sessions).toEqual([]);
    } finally { await tab.close(); }
  });
}

test('BA08: abort after an IndexedDB delete succeeds restores every record in the profile transaction', async ({ page }) => {
  const target = legacyFixture('ba08-delete-rollback', 'ba08-target-learner');
  const other = legacyFixture('ba08-delete-rollback-other', 'ba08-other-learner');
  await seedLegacy(page, 3, { packs: [{ key: `${target.pack.id}@1`, pack: target.pack }], profiles: [target.profile, other.profile], sessions: [target.session], events: [target.event], reviews: [target.review] });
  await harness(page); await call(page, 'listProfiles');
  const bytes = JSON.stringify(await snapshot(page));
  await page.evaluate(() => {
    const native = IDBObjectStore.prototype.delete;
    const probe = { firstDeleteSucceeded: false, aborted: false, stores: [] as string[] };
    IDBObjectStore.prototype.delete = function (key) {
      const request = native.call(this, key);
      if (this.transaction.mode === 'readwrite' && this.transaction.objectStoreNames.contains('profiles')) {
        IDBObjectStore.prototype.delete = native;
        const tx = this.transaction;
        probe.stores = Array.from(tx.objectStoreNames);
        tx.addEventListener('abort', () => { probe.aborted = true; });
        request.addEventListener('success', () => { probe.firstDeleteSucceeded = true; tx.abort(); });
      }
      return request;
    };
    (window as unknown as { __deleteRollback: typeof probe }).__deleteRollback = probe;
  });
  const result = await invoke(page, 'deleteProfile', [target.profile.profileId]);
  expect(result.ok).toBe(false);
  const probe = await page.evaluate(() => (window as unknown as { __deleteRollback: { firstDeleteSucceeded: boolean; aborted: boolean; stores: string[] } }).__deleteRollback);
  expect(probe.firstDeleteSucceeded).toBe(true); expect(probe.aborted).toBe(true); expect(probe.stores).toEqual(mutableStores);
  expect(JSON.stringify(await snapshot(page))).toBe(bytes);
  await call(page, 'deleteProfile', [target.profile.profileId]);
  expect((await snapshot(page)).rows.profiles).toEqual([other.profile]);
});

test('BA08: concurrent deletion in two tabs keeps at least one profile and rejects the losing transaction', async ({ page, context }) => {
  const first = legacyFixture('ba08-delete-race-first', 'ba08-first-learner');
  const second = legacyFixture('ba08-delete-race-second', 'ba08-second-learner');
  await seedLegacy(page, 3, { packs: [], profiles: [first.profile, second.profile], sessions: [], events: [], reviews: [] });
  await harness(page); await call(page, 'listProfiles');
  const tab = await context.newPage();
  try {
    await harness(tab);
    const results = await Promise.all([invoke(page, 'deleteProfile', [first.profile.profileId]), invoke(tab, 'deleteProfile', [second.profile.profileId])]);
    expect(results.filter(value => value.ok)).toHaveLength(1); expect(results.filter(value => !value.ok)).toHaveLength(1);
    const state = await snapshot(page); expect(state.rows.profiles).toHaveLength(1);
    const survivor = (state.rows.profiles[0] as LearnerProfile).profileId;
    expect([first.profile.profileId, second.profile.profileId]).toContain(survivor);
  } finally { await tab.close(); }
});

test('BA08: versionchange closes the cached application connection so a future database can upgrade without hanging', async ({ page, context }) => {
  await harness(page); await call(page, 'listProfiles');
  const tab = await context.newPage();
  try {
    await tab.goto(`${server.origin}/qa-fixture`);
    const result = await tab.evaluate(async name => {
      return await new Promise<{ version: number; blocked: boolean }>((resolve, reject) => {
        let blocked = false;
        const request = indexedDB.open(name, 5);
        request.onblocked = () => { blocked = true; };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { const db = request.result; const version = db.version; db.close(); resolve({ version, blocked }); };
      });
    }, databaseName);
    expect(result).toEqual({ version: 5, blocked: false });
    const next = await invoke(page, 'listProfiles');
    expect(next.ok).toBe(false); if (!next.ok) expect(next.message).toMatch(/(?:phiên bản|nâng cấp|mới hơn|VersionError|requested version)/i);
  } finally { await tab.close(); }
});

test('BA08: a tab holding DB v3 reports a blocked upgrade, then releasing it permits a clean v4 retry', async ({ page, context }) => {
  const fixture = legacyFixture('ba08-blocked', 'ba08-blocked-learner');
  await seedLegacy(page, 3, { packs: [{ key: `${fixture.pack.id}@1`, pack: fixture.pack }], profiles: [fixture.profile], sessions: [fixture.session], events: [fixture.event], reviews: [fixture.review] });
  await page.evaluate(async name => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    (window as unknown as { __oldConnection: IDBDatabase }).__oldConnection = db;
  }, databaseName);
  const before = await snapshot(page);
  const tab = await context.newPage();
  try {
    await tab.goto(server.origin+'/?view=games&controls=1');
    await expect(tab.locator('.global-error')).toContainText(/tab.*chặn nâng cấp/);
    expect(await snapshot(page, true)).toEqual(before);
    await page.evaluate(() => (window as unknown as { __oldConnection: IDBDatabase }).__oldConnection.close());
    await tab.reload();
    await expect(tab.getByRole('navigation', { name: 'Chọn đảo học tập' })).toBeVisible();
    await expect(tab.locator('.global-error')).toHaveCount(0);
    const after = await snapshot(tab); assertSchema(after);
    Object.keys(before.rows).forEach(store => expect(after.rows[store]).toEqual(before.rows[store]));
    expect(after.rows.sessionResults).toEqual([]); expect(after.rows.lessonProgress).toEqual([]);
  } finally {
    await page.evaluate(() => (window as unknown as { __oldConnection?: IDBDatabase }).__oldConnection?.close());
    await tab.close();
  }
});
