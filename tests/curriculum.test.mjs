import test from 'node:test';
import assert from 'node:assert/strict';
import { learningStorageFixture } from './visual/helpers/learning-storage-fixture.ts';
import {
  captureExposureSources, curriculumKey, itemRefKey, lessonScopeKey, rebuildLessonProgress, sessionResultId, totalRewardStars,
  validateCurriculum, validateLearnerSettings, validateLearningSession, validateLessonEvent, validateSessionExposureSources, validateSessionResult, vietnamLearningDay,
} from '../src/core/curriculum.ts';

const clone = value => structuredClone(value);
const fixture = () => learningStorageFixture('catalog');
const context = (f, sessions = [f.session], events = f.events, results = [f.result]) => ({
  curricula: [f.curriculum], packs: [f.pack], profiles: [f.profile], sessions, events, results,
});

function independent(f, mode = 'lesson-assessment', { start = '2026-10-12T11:00:00.000Z', correct = 4, suffix = 'first', sourcePass } = {}) {
  const form = f.curriculum.lessons[0].forms.find(form => form.role === (mode === 'lesson-review' ? 'review' : 'assessment'));
  const sessionId = `catalog-${suffix}-${mode}`, completedAt = new Date(Date.parse(start) + 60_000).toISOString();
  const events = form.itemRefs.map((itemRef, index) => ({ ...clone(f.events[index]), eventId: `${sessionId}:answer-${index}`, sessionId, itemRef,
    response: { version: 1, kind: 'choice', selectedIndex: index < correct ? 0 : 1 }, correct: index < correct,
    occurredAt: new Date(Date.parse(start) + (10 + index) * 1000).toISOString() }));
  const sourcePracticeResultIds = mode === 'lesson-assessment' ? [f.result.resultId] : [];
  const session = { ...clone(f.session), sessionId, mode, activityId: form.activityId, formId: form.formId, blueprint: form.blueprint,
    startedAt: start, endedAt: completedAt, sourcePracticeResultIds,
    checkpoint: { ...clone(f.session.checkpoint), formId: form.formId, itemOrder: form.itemRefs, receipts: events.map(event => ({ attemptKey: event.attemptKey,
      eventId: event.eventId, itemKey: itemRefKey(event.itemRef), submissionIndex: event.submissionIndex, committedAt: event.occurredAt })), exposedItemKeys: [], updatedAt: completedAt },
    ...(sourcePass ? { sourcePassResultId: sourcePass.resultId } : {}) };
  const result = { ...clone(f.result), resultId: sessionResultId(sessionId), sessionId, mode, formId: form.formId, independent: true,
    passed: correct >= 4, starTier: correct >= 4 ? (mode === 'lesson-review' ? 3 : 2) : 0, firstAttemptCorrect: correct,
    coverage: [{ objectiveId: f.pack.items[0].objectiveId, answered: 5, firstAttemptCorrect: correct }], eventIds: events.map(event => event.eventId),
    itemKeys: events.map(event => itemRefKey(event.itemRef)), practiceCorrected: correct === 5, sourcePracticeResultIds, completedAt,
    localDay: vietnamLearningDay(completedAt), ...(sourcePass ? { sourcePassResultId: sourcePass.resultId } : {}) };
  return { session, events, result };
}

test('valid published catalog, pinned profile, practice session/event/result pass', () => {
  const f = fixture(), ctx = context(f);
  assert.deepEqual(validateCurriculum(f.curriculum, [f.pack]), []);
  assert.deepEqual(validateLearnerSettings(f.profile.learningSettings, [f.curriculum]), []);
  assert.deepEqual(validateLearningSession(f.session, [f.curriculum], [f.pack], [f.profile]), []);
  for (const event of f.events) assert.deepEqual(validateLessonEvent(event, f.session, [f.curriculum], [f.pack]), []);
  assert.deepEqual(validateSessionResult(f.result, ctx), []);
});

test('unknown shape and accessor input return diagnostics without executing code', () => {
  const f = fixture();
  for (const value of [null, false, [], 'bad', {}, { ...f.curriculum, lessons: [null] }, { ...f.curriculum, policies: [null] }]) {
    assert.doesNotThrow(() => assert.ok(validateCurriculum(value, [f.pack]).length));
  }
  let invoked = false;
  const accessor = { ...f.curriculum };
  Object.defineProperty(accessor, 'title', { enumerable: true, get() { invoked = true; throw new Error('getter executed'); } });
  assert.ok(validateCurriculum(accessor, [f.pack]).length);
  assert.equal(invoked, false);
  for (const fn of [value => validateLearnerSettings(value, [f.curriculum]), value => validateLearningSession(value, [f.curriculum], [f.pack]),
    value => validateLessonEvent(value, f.session, [f.curriculum], [f.pack]), value => validateSessionResult(value, context(f))]) {
    for (const value of [null, [], {}]) assert.doesNotThrow(() => assert.ok(fn(value).length));
  }
});

test('catalog rejects duplicate IDs, missing refs, wrong subject/grade and prerequisite cycles', () => {
  const f = fixture();
  const cases = [
    c => { c.lessons.push(clone(c.lessons[0])); },
    c => { c.lessons[0].forms[1].itemRefs[0].contentVersion = 2; },
    c => { c.lessons[0].subject = 'english'; },
    c => { c.topics[0].grade = 4; },
    c => { c.lessons[0].policyRevision = 2; },
    c => { c.lessons[0].prerequisiteLessonIds = ['missing-lesson']; },
    c => {
      const second = clone(c.lessons[0]); second.lessonId = 'catalog-second'; second.rewardGroupId = 'catalog-second-reward';
      second.prerequisiteLessonIds = [c.lessons[0].lessonId]; c.lessons[0].prerequisiteLessonIds = [second.lessonId];
      c.lessons.push(second); c.topics[0].lessonIds.push(second.lessonId);
    },
  ];
  for (const mutate of cases) { const c = clone(f.curriculum); mutate(c); assert.ok(validateCurriculum(c, [f.pack]).length); }
});

test('blueprint rejects missing objective coverage, fewer than five independent items and Memory assessment', () => {
  const f = fixture();
  const cases = [
    c => { c.lessons[0].forms[1].itemRefs.pop(); },
    c => { c.lessons[0].forms[1].blueprint.minimumItems = 4; },
    c => { c.lessons[0].forms[1].blueprint.objectives[0].objectiveId = 'different-objective'; },
    c => { c.lessons[0].objectiveIds.push('untested-objective'); },
    c => { c.lessons[0].forms[1].activityId = 'memory-match'; },
    c => { c.lessons[0].forms[2].equivalenceGroupId = 'unreviewed-group'; },
  ];
  for (const mutate of cases) { const c = clone(f.curriculum); mutate(c); assert.ok(validateCurriculum(c, [f.pack]).length); }
});

test('independent forms are disjoint by exact reference and by content despite IDs/option order', () => {
  const f = fixture(), c = clone(f.curriculum);
  c.lessons[0].forms[1].itemRefs[0] = clone(c.lessons[0].forms[0].itemRefs[0]);
  assert.ok(validateCurriculum(c, [f.pack]).some(error => error.includes('không độc lập')));
  const pack = clone(f.pack);
  pack.items[5].prompt = pack.items[0].prompt;
  pack.items[5].options = [...pack.items[0].options].reverse(); pack.items[5].correctIndex = 3;
  assert.ok(validateCurriculum(f.curriculum, [pack]).some(error => error.includes('đổi ID')));
});

test('settings and session require exact enrollment while manual unlock grants no result', () => {
  const f = fixture(), settings = clone(f.profile.learningSettings);
  settings.enrollments[0].manualUnlocks = [{ lessonId: 'missing-lesson', reason: 'Cho thử', openedAt: f.curriculum.publishedAt }];
  assert.ok(validateLearnerSettings(settings, [f.curriculum]).length);
  settings.enrollments[0].manualUnlocks = []; settings.enrollments[0].curriculumRevision = 2;
  assert.ok(validateLearnerSettings(settings, [f.curriculum]).length);
  for (const profile of [{ ...f.profile, learningSettings: undefined }, { ...f.profile, learningSettings: { ...f.profile.learningSettings, enrollments: [] } }]) {
    assert.ok(validateLearningSession(f.session, [f.curriculum], [f.pack], [profile]).some(error => error.includes('ghim')));
  }
  const altered = clone(f.session); altered.scope.lessonRevision = 2;
  assert.ok(validateLearningSession(altered, [f.curriculum], [f.pack], [f.profile]).length);
});

test('checkpoint rejects replaced, missing, duplicated items and phantom receipts', () => {
  const f = fixture();
  for (const mutate of [s => { s.checkpoint.itemOrder.pop(); }, s => { s.checkpoint.itemOrder[1] = clone(s.checkpoint.itemOrder[0]); },
    s => { s.checkpoint.formRevision = 2; }, s => { s.scope.profileId = 'different-profile'; }]) {
    const s = clone(f.session); mutate(s); assert.ok(validateLearningSession(s, [f.curriculum], [f.pack], [f.profile]).length);
  }
  const s = clone(f.session); s.checkpoint.receipts.push({ ...s.checkpoint.receipts[0], attemptKey: 'phantom', eventId: `${s.sessionId}:phantom` });
  assert.ok(validateSessionResult(f.result, context(f, [s])).some(error => error.includes('receipt thừa')));
});

test('first attempt score and host scoring cannot be replaced by arbitrary correct flags', () => {
  const f = fixture(), a = independent(f);
  const ctx = context(f, [f.session, a.session], [...f.events, ...a.events], [f.result, a.result]);
  assert.deepEqual(validateSessionResult(a.result, ctx), []);
  const forged = clone(a.result); forged.firstAttemptCorrect = 5;
  assert.ok(validateSessionResult(forged, ctx).some(error => error.includes('điểm lần đầu')));
  const forgedEvents = clone(a.events); forgedEvents[4].correct = true;
  assert.ok(validateSessionResult(a.result, { ...ctx, events: [...f.events, ...forgedEvents] }).some(error => error.includes('đáp án')));
  const partial = clone(a.result); partial.eventIds.pop();
  assert.ok(validateSessionResult(partial, ctx).length);
  const missingPractice = clone(a.result); missingPractice.sourcePracticeResultIds = [];
  const missingSession = clone(a.session); missingSession.sourcePracticeResultIds = [];
  assert.ok(validateSessionResult(missingPractice, { ...ctx, sessions: [f.session, missingSession] }).length);
});

test('3/5 completes without passed and 4/5 receives exactly tier two', () => {
  const f = fixture(), failed = independent(f, 'lesson-assessment', { correct: 3 }), passed = independent(f);
  for (const a of [failed, passed]) assert.deepEqual(validateSessionResult(a.result,
    context(f, [f.session, a.session], [...f.events, ...a.events], [f.result, a.result])), []);
  assert.equal(failed.result.completed, true); assert.equal(failed.result.passed, false); assert.equal(failed.result.starTier, 0);
  assert.equal(passed.result.passed, true); assert.equal(passed.result.starTier, 2);
});

test('hints and correcting a failed independent answer never preserve independent stars', () => {
  const f = fixture(), a = independent(f, 'lesson-assessment', { correct: 5 });
  a.events[0].hintsUsed = 1; a.result.hintsUsed = 1;
  assert.ok(validateSessionResult(a.result, context(f, [f.session, a.session], [...f.events, ...a.events], [f.result, a.result])).some(error => error.includes('độc lập')));
  const b = independent(f);
  const correction = { ...clone(b.events[4]), eventId: `${b.session.sessionId}:correction`, attemptKey: 'correction', sequence: 6, submissionIndex: 2,
    response: { version: 1, kind: 'choice', selectedIndex: 0 }, correct: true, occurredAt: '2026-10-12T11:00:30.000Z' };
  b.events.push(correction); b.session.checkpoint.receipts.push({ attemptKey: correction.attemptKey, eventId: correction.eventId,
    itemKey: itemRefKey(correction.itemRef), submissionIndex: 2, committedAt: correction.occurredAt });
  b.result.eventIds.push(correction.eventId); b.result.practiceCorrected = true;
  assert.ok(validateSessionResult(b.result, context(f, [f.session, b.session], [...f.events, ...b.events], [f.result, b.result])).some(error => error.includes('độc lập')));
});

test('review requires 24 hours and a different Vietnamese day when the session starts', () => {
  const f = fixture(), a = independent(f), r = independent(f, 'lesson-review', { start: '2026-10-13T11:01:00.000Z', sourcePass: a.result });
  const ctx = context(f, [f.session, a.session, r.session], [...f.events, ...a.events, ...r.events], [f.result, a.result, r.result]);
  assert.deepEqual(validateSessionResult(r.result, ctx), []);
  const early = independent(f, 'lesson-review', { start: '2026-10-13T11:00:30.000Z', sourcePass: a.result });
  assert.ok(Date.parse(early.result.completedAt) - Date.parse(a.result.completedAt) >= 86_400_000);
  assert.ok(validateSessionResult(early.result, context(f, [f.session, a.session, early.session], [...f.events, ...a.events, ...early.events], [f.result, a.result, early.result])).some(error => error.includes('24 giờ')));
  assert.equal(vietnamLearningDay('2026-10-12T16:59:59.000Z'), '2026-10-12');
  assert.equal(vietnamLearningDay('2026-10-12T17:00:00.000Z'), '2026-10-13');
});

test('malformed or missing source graph produces diagnostics, never a TypeError', () => {
  const f = fixture(), a = independent(f);
  for (const source of [null, {}, { resultId: f.result.resultId, scope: null }, { ...f.result, scope: null }]) {
    assert.doesNotThrow(() => assert.ok(validateSessionResult(a.result,
      context(f, [f.session, a.session], [...f.events, ...a.events], [source, a.result])).length));
  }
  const badEvent = clone(a.events[0]); badEvent.itemRef = null;
  assert.doesNotThrow(() => assert.ok(validateSessionResult(a.result,
    context(f, [f.session, a.session], [...f.events, badEvent, ...a.events.slice(1)], [f.result, a.result])).length));
});

test('previously completed or partially exposed form cannot be relabelled as independent', () => {
  const f = fixture(), a = independent(f), replay = independent(f, 'lesson-assessment', { suffix: 'replay', start: '2026-10-12T12:00:00.000Z' });
  assert.ok(validateSessionResult(replay.result, context(f, [f.session, a.session, replay.session], [...f.events, ...a.events, ...replay.events],
    [f.result, a.result, replay.result])).some(error => error.includes('độc lập')));
  const exposed = clone(a.session); exposed.status = 'paused'; delete exposed.endedAt; exposed.checkpoint.exposedItemKeys = a.result.itemKeys.slice(0, 1);
  assert.ok(validateSessionResult(replay.result, context(f, [f.session, exposed, replay.session], [...f.events, ...a.events, ...replay.events],
    [f.result, replay.result])).some(error => error.includes('độc lập')));
});

test('publishing a new lesson revision does not erase prior answer exposure for the learner', () => {
  const f = fixture(), firstPass = independent(f);
  const next = clone(f);
  next.curriculum.revision = 2; next.curriculum.lessons[0].revision = 2;
  next.profile.learningSettings.enrollments.push({ ...clone(next.profile.learningSettings.enrollments[0]), curriculumRevision: 2 });
  const newScope = { ...next.session.scope, curriculumRevision: 2, lessonRevision: 2 };
  const practiceId = 'catalog-revision2-practice';
  next.session.sessionId = practiceId; next.session.scope = newScope;
  next.session.startedAt = '2026-10-12T12:00:00.000Z'; next.session.endedAt = '2026-10-12T12:01:00.000Z';
  next.session.checkpoint.updatedAt = next.session.endedAt;
  next.events = next.events.map((event, index) => ({ ...event, sessionId: practiceId, eventId: `${practiceId}:${event.attemptKey}`, scope: newScope,
    occurredAt: `2026-10-12T12:00:${String(index + 10).padStart(2, '0')}.000Z` }));
  next.session.checkpoint.receipts = next.events.map(event => ({ attemptKey: event.attemptKey, eventId: event.eventId,
    itemKey: itemRefKey(event.itemRef), submissionIndex: event.submissionIndex, committedAt: event.occurredAt }));
  next.result = { ...next.result, sessionId: practiceId, resultId: sessionResultId(practiceId), scope: newScope,
    eventIds: next.events.map(event => event.eventId), completedAt: next.session.endedAt };
  const secondPass = independent(next, 'lesson-assessment', { suffix: 'revision2', start: '2026-10-12T13:00:00.000Z' });
  const ctx = { curricula: [f.curriculum, next.curriculum], packs: [f.pack], profiles: [next.profile],
    sessions: [f.session, firstPass.session, next.session, secondPass.session], events: [...f.events, ...firstPass.events, ...next.events, ...secondPass.events],
    results: [f.result, firstPass.result, next.result, secondPass.result] };
  assert.deepEqual(validateSessionResult(next.result, ctx), []);
  assert.ok(validateSessionResult(secondPass.result, ctx).some(error => error.includes('độc lập')));
  secondPass.session.exposureSources = captureExposureSources(secondPass.session, ctx);
  assert.ok(secondPass.session.exposureSources.resultIds.includes(firstPass.result.resultId));
  assert.ok(validateSessionResult(secondPass.result, ctx).some(error => error.includes('độc lập')));
  const otherLearner = clone(ctx);
  for (const result of otherLearner.results.slice(0, 2)) { result.profileId = 'other-learner'; result.scope.profileId = 'other-learner'; }
  for (const session of otherLearner.sessions.slice(0, 2)) { session.profileId = 'other-learner'; session.scope.profileId = 'other-learner'; }
  delete otherLearner.sessions[3].exposureSources;
  assert.deepEqual(validateSessionResult(secondPass.result, otherLearner), []);
});

test('merging independently created device sessions preserves each committed exposure basis', () => {
  const f = fixture(), a = independent(f), b = independent(f, 'lesson-assessment', { suffix: 'device-b', start: '2026-10-12T12:00:00.000Z' });
  const originalContext = context(f);
  a.session.exposureSources = captureExposureSources(a.session, originalContext);
  b.session.exposureSources = captureExposureSources(b.session, originalContext);
  const merged = context(f, [f.session, a.session, b.session], [...f.events, ...a.events, ...b.events], [f.result, a.result, b.result]);
  assert.deepEqual(validateSessionResult(a.result, merged), []);
  assert.deepEqual(validateSessionResult(b.result, merged), []);
  assert.equal(totalRewardStars(rebuildLessonProgress(merged.results, merged.curricula), f.profile.profileId), 2);
  b.session.exposureSources = captureExposureSources(b.session, merged);
  assert.ok(b.session.exposureSources.resultIds.includes(a.result.resultId));
  assert.ok(validateSessionResult(b.result, merged).some(error => error.includes('độc lập')));
});

test('exposure snapshots reject fabricated, missing, foreign or future sources without throwing', () => {
  const f = fixture(), a = independent(f);
  const ctx = context(f, [f.session, a.session], [...f.events, ...a.events], [f.result, a.result]);
  const valid = captureExposureSources(a.session, ctx);
  a.session.exposureSources = valid;
  assert.deepEqual(validateSessionExposureSources(a.session, ctx), []);
  for (const mutate of [
    s => { s.exposureSources.itemKeys.push(itemRefKey({ packId: 'missing-pack', contentVersion: 1, itemId: 'missing-item' })); },
    s => { s.exposureSources.resultIds.push('result:missing-result'); },
    s => { s.exposureSources.sessionIds.push('missing-session'); },
    s => { s.exposureSources.resultIds = [a.result.resultId]; },
  ]) {
    const session = clone(a.session); mutate(session); assert.ok(validateSessionExposureSources(session, ctx).length);
  }
  const malformed = { ...ctx, results: [null, { resultId: f.result.resultId, scope: null }], sessions: [null, {}] };
  assert.doesNotThrow(() => assert.ok(validateSessionExposureSources(a.session, malformed).length));
  const foreign = clone(f.result); foreign.profileId = 'other-learner'; foreign.scope.profileId = 'other-learner';
  assert.ok(validateSessionExposureSources(a.session, { ...ctx, results: [foreign] }).length);
  const future = clone(f.result); future.completedAt = '2026-10-12T13:00:00.000Z';
  assert.ok(validateSessionExposureSources(a.session, { ...ctx, results: [future] }).length);
  const paused = clone(f.session); paused.status = 'paused'; delete paused.endedAt; paused.checkpoint.updatedAt = '2026-10-12T13:00:00.000Z';
  const preserved = clone(a.session); preserved.exposureSources = { resultIds: [], sessionIds: [paused.sessionId], itemKeys: [...paused.checkpoint.exposedItemKeys] };
  assert.deepEqual(validateSessionExposureSources(preserved, { results: [], sessions: [paused] }), []);
});

test('progress reconstructs by exact pass scope, deduplicates reward groups across revisions and keeps the first pass anchor', () => {
  const f = fixture(), a = independent(f), r = independent(f, 'lesson-review', { start: '2026-10-13T11:01:00.000Z', sourcePass: a.result });
  const laterPass = { ...clone(a.result), resultId: 'result:later-pass', sessionId: 'later-pass', completedAt: '2026-10-14T11:00:00.000Z', localDay: '2026-10-14' };
  const revision = { ...clone(a.result), resultId: 'result:revision-pass', sessionId: 'revision-pass', scope: { ...a.result.scope, lessonRevision: 2 } };
  const progress = rebuildLessonProgress([laterPass, r.result, revision, f.result, a.result], [f.curriculum]);
  assert.equal(progress.length, 2);
  const original = progress.find(row => row.scope.lessonRevision === 1);
  assert.equal(original.bestStars, 3); assert.equal(original.passed, true); assert.equal(original.sourcePassResultId, a.result.resultId);
  assert.equal(original.reviewEligibleAt, '2026-10-13T11:01:00.000Z');
  assert.equal(totalRewardStars(progress, f.profile.profileId), 3);
  assert.deepEqual(progress, rebuildLessonProgress([a.result, f.result, revision, r.result, laterPass], [f.curriculum]));
  assert.notEqual(lessonScopeKey(a.result.scope), lessonScopeKey(revision.scope));
  assert.equal(curriculumKey(f.curriculum), JSON.stringify([f.curriculum.curriculumId, 1]));
  assert.notEqual(lessonScopeKey({ ...a.result.scope, profileId: 'a:b', curriculumId: 'c' }), lessonScopeKey({ ...a.result.scope, profileId: 'a', curriculumId: 'b:c' }));
});
