import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_PACKS } from '../src/core/seed.ts';
import { makeLearningEvent } from '../src/core/sdk.ts';
import { buildReviewUpdate } from '../src/core/spacedRepetition.ts';
import { calculateReport } from '../src/core/reports.ts';
import { parseContentImport } from '../src/core/content-io.ts';
import { captureExposureSources, curriculumKey, itemRefKey, lessonScopeKey, rebuildLessonProgress, sessionResultId } from '../src/core/curriculum.ts';
import {
  BACKUP_SCHEMA, BACKUP_FORMAT_VERSION, BACKUP_LIMITS, MAX_BACKUP_BYTES,
  parseLearningBackup, prepareBackupRestore, serializeLearningBackup, validateLearningBackup
} from '../src/core/backup-io.ts';

const exportedAt = '2026-10-14T12:00:00.000Z';
const empty = () => ({ packs: [], sessions: [], events: [], profiles: [], reviews: [], curricula: [], sessionResults: [], lessonProgress: [] });
const counts = (packs = 0, sessions = 0, events = 0, profiles = 0, reviews = 0, curricula = 0, sessionResults = 0, lessonProgress = 0) => ({ packs, sessions, events, profiles, reviews, curricula, sessionResults, lessonProgress });
const copy = value => structuredClone(value);
function fixture() {
  const packs = copy([BUILTIN_PACKS[0], BUILTIN_PACKS[1], BUILTIN_PACKS.find(pack=>pack.id==='english3-sentences')]);
  const modules = ['math-quest', 'memory-match', 'sentence-builder'];
  const sessions = packs.map((pack, index) => ({
    sessionId: `profile-${index}`, packId: pack.id, contentVersion: pack.version,
    profileId: 'default-learner',
    moduleId: modules[index], moduleVersion: '0.2.7',
    startedAt: '2026-10-13T10:00:00.000Z', endedAt: '2026-10-13T10:01:00.000Z', status: 'completed'
  }));
  const events = sessions.flatMap((session, index) => [false, true].map((correct, attempt) => makeLearningEvent(
    { ...session, status: 'active' }, packs[index], {
      attemptKey: index === 1 ? `move-${attempt + 1}` : `${packs[index].items[0].id}:try:${attempt + 1}`,
      itemId: packs[index].items[0].id, objectiveId: packs[index].items[0].objectiveId,
      correct, hintsUsed: attempt, elapsedMs: 1234.5
    }, `2026-10-13T10:00:${String(10 + attempt).padStart(2, '0')}.000Z`
  )));
  const profiles = [{ profileId: 'default-learner', name: 'Bé Học Giỏi', avatar: 'fox', grade: 3,
    colorTheme: 'teal', createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z' }];
  const reviews = packs.map(pack => ({ cardId: `default-learner:${pack.items[0].id}`, profileId: 'default-learner',
    packId: pack.id, itemId: pack.items[0].id, repetitions: 1, intervalDays: 1, easeFactor: 2.6,
    lastQuality: 5, lastReviewedAt: '2026-10-13T10:00:10.000Z', nextReviewDate: '2026-10-14' }));
  return { schema: BACKUP_SCHEMA, formatVersion: BACKUP_FORMAT_VERSION, exportedAt, appVersion: '3.7.0-rc.1', packs, sessions, events,
    profiles, reviews, curricula: [], sessionResults: [], lessonProgress: [] };
}
function localFixture() {
  const data = fixture();
  data.packs[0].id = 'teacher-math'; data.packs[0].source = 'local';
  data.sessions[0].packId = data.packs[0].id;
  data.events.filter(event => event.sessionId === data.sessions[0].sessionId).forEach(event => { event.packId = data.packs[0].id; });
  data.reviews[0].packId = data.packs[0].id;
  return data;
}

function lessonFixture() {
  const data = { ...empty(), schema: BACKUP_SCHEMA, formatVersion: BACKUP_FORMAT_VERSION, exportedAt };
  const pack = { id: 'qa-lesson-math', version: 1, title: 'Toán 3 kiểm chứng backup', subject: 'math', grade: 3, source: 'local', publishedAt: '2026-10-12T00:00:00.000Z', kind: 'quiz',
    items: Array.from({ length: 18 }, (_, index) => ({ kind: 'multiple-choice', id: `qa-q${index + 1}`, objectiveId: 'MATH3.QA', prompt: `${index + 1} + 1 = ?`, options: [String(index + 2), String(index + 3), String(index + 4), String(index + 5)], correctIndex: 0, explanation: `Cộng thêm 1 được ${index + 2}.` })) };
  data.packs = [pack];
  const ref = item => ({ packId: pack.id, contentVersion: 1, itemId: item.id });
  const blueprint = { blueprintId: 'qa-blueprint', revision: 1, minimumItems: 6, objectives: [{ objectiveId: 'MATH3.QA', minimumItems: 6 }], allowReadAloud: false };
  const forms = ['practice', 'assessment', 'review'].map((role, index) => ({ formId: `qa-${role}`, revision: 1, role, blueprint: copy(blueprint), itemRefs: pack.items.slice(index * 6, index * 6 + 6).map(ref), equivalenceGroupId: 'qa-equivalent', approvedAt: '2026-10-12T00:00:00.000Z', activityId: role === 'practice' ? 'practice-runner' : role === 'assessment' ? 'lesson-assessment' : 'lesson-review' }));
  const curriculum = { schemaVersion: 1, curriculumId: 'qa-math3', revision: 1, title: 'Toán 3 QA', subject: 'math', grade: 3, publishedAt: '2026-10-12T00:00:00.000Z',
    topics: [{ topicId: 'qa-topic', title: 'Cộng một', subject: 'math', grade: 3, lessonIds: ['qa-lesson'] }],
    policies: [{ policyId: 'qa-policy', revision: 1, passPercent: 80, minIndependentItems: 5, reviewDelayHours: 24, timeZone: 'Asia/Ho_Chi_Minh' }],
    lessons: [{ lessonId: 'qa-lesson', revision: 1, rewardGroupId: 'qa-reward', topicId: 'qa-topic', subject: 'math', grade: 3, title: 'Cộng thêm một', objectiveIds: ['MATH3.QA'], prerequisiteLessonIds: [], policyId: 'qa-policy', policyRevision: 1, steps: [{ stepId: 'qa-read', title: 'Cộng một', body: 'Cộng một là số liền sau.' }], forms }], media: [] };
  data.curricula = [curriculum];
  data.profiles = [{ ...fixture().profiles[0], learningSettings: { schemaVersion: 1, preferredSubjects: ['math'], enrollments: [{ curriculumId: curriculum.curriculumId, curriculumRevision: 1, enrolledAt: '2026-10-12T10:00:00.000Z', manualUnlocks: [] }] } }];
  const scope = { profileId: 'default-learner', curriculumId: curriculum.curriculumId, curriculumRevision: 1, lessonId: 'qa-lesson', lessonRevision: 1, policyId: 'qa-policy', policyRevision: 1 };
  for (const [index, form] of forms.entries()) {
    const sessionId = `qa-session-${index}`;
    const day = index === 2 ? 14 : 13;
    const hour = index === 0 ? 9 : index === 1 ? 10 : 11;
    const startedAt = `2026-10-${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;
    const completedAt = `2026-10-${day}T${String(hour).padStart(2, '0')}:01:00.000Z`;
    const mode = ['lesson-practice', 'lesson-assessment', 'lesson-review'][index];
    const sourcePracticeResultIds = index === 0 ? [] : [sessionResultId('qa-session-0')];
    const events = form.itemRefs.map((itemRef, n) => ({ schemaVersion: 1, eventId: `${sessionId}:answer-${n + 1}`, attemptKey: `answer-${n + 1}`, sessionId, profileId: scope.profileId, scope: copy(scope), itemRef, objectiveId: 'MATH3.QA', sequence: n + 1, submissionIndex: 1, response: { version: 1, kind: 'choice', selectedIndex: 0 }, correct: true, hintsUsed: 0, elapsedMs: 1000, occurredAt: startedAt.replace(':00.000Z', `:${String(n + 10).padStart(2, '0')}.000Z`) }));
    const session = { schemaVersion: 1, sessionId, profileId: scope.profileId, mode, activityId: form.activityId, activityVersion: '1.0.0', scope: copy(scope), rewardGroupId: 'qa-reward', formId: form.formId, formRevision: 1, blueprint: copy(blueprint), startedAt, endedAt: completedAt, status: 'completed',
      checkpoint: { schemaVersion: 1, stepIndex: 1, readStepIds: ['qa-read'], formId: form.formId, formRevision: 1, seed: `qa-seed-${index}`, itemOrder: copy(form.itemRefs), receipts: events.map(event => ({ attemptKey: event.attemptKey, eventId: event.eventId, itemKey: itemRefKey(event.itemRef), submissionIndex: 1, committedAt: event.occurredAt })), exposedItemKeys: index === 0 ? form.itemRefs.map(itemRefKey) : [], updatedAt: completedAt }, sourcePracticeResultIds };
    const result = { schemaVersion: 1, resultId: sessionResultId(sessionId), sessionId, profileId: scope.profileId, scope: copy(scope), rewardGroupId: 'qa-reward', mode, formId: form.formId, formRevision: 1, blueprintId: blueprint.blueprintId, blueprintRevision: 1, completed: true, passed: index > 0, independent: index > 0, starTier: index + 1, firstAttemptCorrect: 6, totalItems: 6, coverage: [{ objectiveId: 'MATH3.QA', answered: 6, firstAttemptCorrect: 6 }], eventIds: events.map(event => event.eventId), itemKeys: form.itemRefs.map(itemRefKey), readStepIds: ['qa-read'], practiceCorrected: true, hintsUsed: 0, sourcePracticeResultIds, completedAt, localDay: `2026-10-${day}` };
    if (index === 2) { session.sourcePassResultId = sessionResultId('qa-session-1'); result.sourcePassResultId = session.sourcePassResultId; }
    data.sessions.push(session); data.events.push(...events); data.sessionResults.push(result);
  }
  data.lessonProgress = rebuildLessonProgress(data.sessionResults, data.curricula);
  return data;
}

test('Backup round-trip preserves packs, versions, sessions, attempts and report for all three games', () => {
  const source = fixture();
  const raw = serializeLearningBackup(source, exportedAt, source.appVersion);
  const restored = parseLearningBackup(raw);
  assert.deepEqual(restored, source);
  assert.deepEqual(calculateReport(restored.events, restored.sessions), calculateReport(source.events, source.sessions));
  assert.equal(restored.events.length, 6);
  assert.equal(restored.events.filter(event => event.moduleId === 'memory-match').length, 2);
  assert.equal(restored.packs.every(pack => pack.source === 'builtin'), true);
  assert.equal(Object.hasOwn(restored.packs[0], 'pack'), false);
  restored.packs[0].items[0].prompt = 'Changed independently';
  assert.notEqual(source.packs[0].items[0].prompt, restored.packs[0].items[0].prompt);
});

test('An empty profile has a valid backup; optional app metadata is not fabricated', () => {
  const restored = parseLearningBackup(serializeLearningBackup(empty(), exportedAt));
  assert.deepEqual(restored.packs, []);
  assert.equal(Object.hasOwn(restored, 'appVersion'), false);
  assert.throws(() => serializeLearningBackup(empty(), exportedAt, 'unknown version'), /Phiên bản ứng dụng/);
  const freshExport = parseLearningBackup(serializeLearningBackup(fixture(), '2026-10-15T12:00:00Z', '3.8.0'));
  assert.equal(freshExport.exportedAt, '2026-10-15T12:00:00Z');
  assert.equal(freshExport.appVersion, '3.8.0');
});

test('Backup parser rejects content-only files, bad JSON, unknown schema/version and oversized UTF-8 input', () => {
  assert.throws(() => parseLearningBackup('not JSON'), /JSON/);
  assert.throws(() => parseLearningBackup({}), /JSON/);
  assert.throws(() => parseLearningBackup(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs: BUILTIN_PACKS })), /định dạng/);
  assert.throws(() => validateLearningBackup({ ...fixture(), formatVersion: 3 }), /định dạng/);
  assert.throws(() => parseLearningBackup('ế'.repeat(Math.floor(MAX_BACKUP_BYTES / 3) + 1)), /10 MB/);
});

test('All eight collections enforce count limits before reading their rows', () => {
  for (const collection of Object.keys(BACKUP_LIMITS)) {
    const source = fixture(); source[collection] = Array(BACKUP_LIMITS[collection] + 1).fill(null);
    assert.throws(() => validateLearningBackup(source), /vượt giới hạn/);
  }
  for (const collection of Object.keys(BACKUP_LIMITS)) {
    const source = fixture(); source[collection] = null;
    assert.throws(() => validateLearningBackup(source), /danh sách/);
  }
});

test('Backup objects cannot import PIN/settings, accessors, prototypes or SavedPack wrappers', () => {
  assert.throws(() => validateLearningBackup({ ...fixture(), pin: '1234' }), /trường/);
  const inherited = Object.assign(Object.create({ unexpected: true }), fixture());
  assert.throws(() => validateLearningBackup(inherited), /đối tượng/);
  const accessor = fixture(); let invoked = false;
  Object.defineProperty(accessor, 'packs', { enumerable: true, get() { invoked = true; return []; } });
  assert.throws(() => validateLearningBackup(accessor), /trường/);
  assert.equal(invoked, false);
  const poison = JSON.parse(JSON.stringify(fixture()).replace('"schema":', '"__proto__":{"polluted":true},"schema":'));
  assert.throws(() => validateLearningBackup(poison), /trường/);
  assert.equal({}.polluted, undefined);
  const wrapper = fixture(); wrapper.packs[0] = { key: 'math3-adventure@1', pack: wrapper.packs[0] };
  assert.throws(() => validateLearningBackup(wrapper), /chuỗi/);
});

test('Published content and known builtin versions are validated without rewriting source or timestamps', () => {
  const source = localFixture();
  source.packs[0].items[0].prompt = '<img src=x onerror=alert(1)> chọn đáp án';
  assert.deepEqual(parseLearningBackup(serializeLearningBackup(source, exportedAt)).packs, source.packs);
  const builtin = fixture(); builtin.packs[0].items[0].correctIndex = 1;
  assert.throws(() => validateLearningBackup(builtin), /tích hợp.*thay đổi/);
  const invalid = localFixture(); invalid.packs[0].items[0].options[1] = invalid.packs[0].items[0].options[0];
  assert.throws(() => validateLearningBackup(invalid), /phương án giống nhau/);
  const typed = localFixture(); typed.packs[0].items[0].explanation = 42;
  assert.throws(() => validateLearningBackup(typed), /chuỗi/);
  const kind = localFixture(); kind.packs[0].items[0].kind = 'pair';
  assert.throws(() => validateLearningBackup(kind), /loại câu hỏi/);
});

test('Every accepted v1 content boundary keeps its title, long objectives, high version and inert extension data in backup', () => {
  const authored = copy(BUILTIN_PACKS[0]);
  authored.id = 'teacher-v1-boundary';
  authored.title = `${' '.repeat(100)}Toán 3 tương thích${' '.repeat(120)}`;
  authored.version = 1e100;
  authored.items[0].objectiveId = `OBJECTIVE.${'x'.repeat(600)}`;
  authored.teacherNotes = { lesson: 'Nội dung bổ sung', levels: [1, 2], approved: false };
  authored.items[0].annotation = { plainText: '<script>inert text</script>' };
  const [pack] = parseContentImport(JSON.stringify({ schema: 'baoan-learning-content', formatVersion: 1, packs: [authored] }));
  const session = { ...fixture().sessions[0], packId: pack.id, contentVersion: pack.version };
  const event = makeLearningEvent({ ...session, status: 'active' }, pack, {
    attemptKey: 'answer-1', itemId: pack.items[0].id, objectiveId: pack.items[0].objectiveId,
    correct: true, hintsUsed: 0, elapsedMs: 1234
  }, '2026-10-13T10:00:10.000Z');
  const profile = { packs: [pack], sessions: [session], events: [event], profiles: fixture().profiles, reviews: [] };
  const restored = parseLearningBackup(serializeLearningBackup(profile, exportedAt));
  assert.deepEqual(restored.packs, profile.packs);
  assert.deepEqual(restored.sessions, profile.sessions);
  assert.deepEqual(restored.events, profile.events);
  assert.equal(prepareBackupRestore(restored, empty()).canRestore, true);
  assert.deepEqual(calculateReport(restored.events, restored.sessions), calculateReport(profile.events, profile.sessions));
});

test('Preserved content extensions still reject executable objects, getters and circular data', () => {
  const executable = localFixture(); executable.packs[0].extension = () => 'not data';
  assert.throws(() => validateLearningBackup(executable), /JSON/);
  const accessor = localFixture(); let invoked = false;
  accessor.packs[0].extension = {};
  Object.defineProperty(accessor.packs[0].extension, 'run', { enumerable: true, get() { invoked = true; return 1; } });
  assert.throws(() => validateLearningBackup(accessor), /trường/);
  assert.equal(invoked, false);
  const cyclic = localFixture(); cyclic.packs[0].extension = cyclic.packs[0];
  assert.throws(() => validateLearningBackup(cyclic), /tham chiếu vòng/);
});

test('Legacy collections require unique internal keys, including otherwise identical records', () => {
  for (const collection of ['packs', 'sessions', 'events', 'profiles', 'reviews']) {
    const source = fixture(); source[collection].push(copy(source[collection][0]));
    assert.throws(() => validateLearningBackup(source), /trùng mã/);
  }
  const version = localFixture(); const second = copy(version.packs[0]); second.version++;
  version.packs.push(second);
  assert.equal(validateLearningBackup(version).packs.length, 4);
});

test('UTC timestamps reject impossible calendar dates and invalid session state chronology', () => {
  for (const bad of ['2026-02-30T00:00:00Z', '2026-10-13', 'yesterday', '2026-10-13T25:00:00Z', '2026-10-13T10:00:00+07:00']) {
    assert.throws(() => validateLearningBackup({ ...fixture(), exportedAt: bad }), /ISO|ngày giờ/);
  }
  assert.doesNotThrow(() => validateLearningBackup({ ...fixture(), exportedAt: '2026-10-14T12:00:00Z' }));
  const ended = fixture(); delete ended.sessions[0].endedAt;
  assert.throws(() => validateLearningBackup(ended), /ISO/);
  const active = fixture(); active.sessions[0].status = 'active';
  assert.throws(() => validateLearningBackup(active), /đang hoạt động/);
  const reversed = fixture(); reversed.sessions[0].endedAt = '2026-10-13T09:00:00Z';
  assert.throws(() => validateLearningBackup(reversed), /thời gian kết thúc/);
  const future = fixture(); future.sessions[0].startedAt = '2026-10-15T10:00:00Z';
  assert.throws(() => validateLearningBackup(future), /sau thời điểm/);
  const status = fixture(); status.sessions[0].status = 'done';
  assert.throws(() => validateLearningBackup(status), /trạng thái/);
});

test('Sessions require a matching pack version and supported module/content combination', () => {
  const missing = fixture(); missing.packs.shift();
  assert.throws(() => validateLearningBackup(missing), /thiếu đúng phiên bản/);
  const version = fixture(); version.sessions[0].contentVersion++;
  assert.throws(() => validateLearningBackup(version), /thiếu đúng phiên bản/);
  const kind = fixture(); kind.sessions[0].moduleId = 'memory-match';
  assert.throws(() => validateLearningBackup(kind), /không tương thích/);
  const module = fixture(); module.sessions[0].moduleId = 'remote-code';
  assert.throws(() => validateLearningBackup(module), /chưa được hỗ trợ/);
  const malformed = fixture(); malformed.sessions[0].moduleVersion = {};
  assert.throws(() => validateLearningBackup(malformed), /phiên bản game/);
});

test('Events require real session/item/objective and exact metadata matching', () => {
  const missing = fixture(); missing.sessions.shift();
  assert.throws(() => validateLearningBackup(missing), /thiếu phiên học/);
  for (const [field, value] of [['packId', 'missing-pack'], ['contentVersion', 2], ['moduleId', 'memory-match'], ['moduleVersion', '0.2.8']]) {
    const source = fixture(); source.events[0][field] = value;
    assert.throws(() => validateLearningBackup(source), /metadata/);
  }
  for (const [field, value] of [['itemId', 'not-a-question'], ['objectiveId', 'UNRELATED.OBJECTIVE']]) {
    const source = fixture(); source.events[0][field] = value;
    assert.throws(() => validateLearningBackup(source), /câu hỏi hoặc mục tiêu/);
  }
  const id = fixture(); id.events[0].eventId = 'some-other-session:move-1';
  assert.throws(() => validateLearningBackup(id), /mã không khớp/);
  const before = fixture(); before.events[0].occurredAt = '2026-10-13T09:59:59Z';
  assert.throws(() => validateLearningBackup(before), /ngoài phiên/);
  const after = fixture(); after.events[0].occurredAt = '2026-10-13T10:01:01Z';
  assert.throws(() => validateLearningBackup(after), /ngoài phiên/);
});

test('Attempt outcomes enforce SDK boolean, hints and finite elapsed bounds', () => {
  for (const [field, value] of [['correct', 'true'], ['correct', 1], ['hintsUsed', -1], ['hintsUsed', 21], ['hintsUsed', 0.5], ['elapsedMs', NaN], ['elapsedMs', Infinity], ['elapsedMs', -1], ['elapsedMs', 14_400_001]]) {
    const source = fixture(); source.events[0][field] = value;
    assert.throws(() => validateLearningBackup(source), /boolean|số nguyên|thời gian làm bài/);
  }
});

test('Restore preview adds complete data, ignores identical current records and never mutates either input', () => {
  const source = fixture(), sourceBefore = copy(source), current = empty();
  const plan = prepareBackupRestore(source, current);
  assert.equal(plan.canRestore, true);
  assert.deepEqual(plan.counts, counts(3, 3, 6, 1, 3));
  assert.deepEqual(plan.duplicates, counts());
  assert.equal(plan.abandonedSessions, 0);
  assert.deepEqual(source, sourceBefore); assert.deepEqual(current, empty());
  const reimport = prepareBackupRestore(source, plan.additions);
  assert.deepEqual(reimport.counts, counts());
  assert.deepEqual(reimport.duplicates, counts(3, 3, 6, 1, 3));
  assert.deepEqual(calculateReport(plan.additions.events, plan.additions.sessions), calculateReport(source.events, source.sessions));
});

test('Canonical comparison ignores object key order while content array order remains meaningful', () => {
  const source = localFixture();
  const reorder = value => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  const current = reorder(source);
  assert.deepEqual(prepareBackupRestore(source, current).duplicates, counts(3, 3, 6, 1, 3));
  current.packs[0].items.reverse();
  const conflict = prepareBackupRestore(source, current);
  assert.equal(conflict.canRestore, false);
  assert.deepEqual(conflict.conflicts, [{ collection: 'packs', key: 'teacher-math@1' }]);
  assert.deepEqual(conflict.additions, empty());
});

test('A conflicting key rejects every addition, across all stores, without overwriting current data', () => {
  const source = localFixture(); const current = empty();
  current.packs = [copy(source.packs[0])]; current.packs[0].title = 'Different curriculum';
  current.sessions = [copy(source.sessions[0])]; current.sessions[0].endedAt = '2026-10-13T10:02:00Z';
  current.events = [copy(source.events[0])]; current.events[0].elapsedMs++;
  current.profiles = copy(source.profiles); current.profiles[0].name = 'Different learner';
  current.reviews = copy(source.reviews); current.reviews[0].repetitions++;
  const before = copy(current);
  const plan = prepareBackupRestore(source, current);
  assert.equal(plan.canRestore, false);
  assert.deepEqual(plan.conflicts.map(conflict => conflict.collection), ['packs', 'sessions', 'events', 'profiles', 'reviews']);
  assert.deepEqual(plan.counts, counts());
  assert.deepEqual(plan.additions, empty());
  assert.deepEqual(current, before);
});

test('Only newly imported active sessions become abandoned at export time; reimport is idempotent', () => {
  const source = fixture(); source.sessions[0].status = 'active'; delete source.sessions[0].endedAt;
  const before = copy(source);
  const first = prepareBackupRestore(source, empty());
  assert.equal(first.abandonedSessions, 1);
  assert.deepEqual(first.additions.sessions[0], { ...source.sessions[0], status: 'abandoned', endedAt: exportedAt });
  assert.deepEqual(first.additions.events, source.events);
  const second = prepareBackupRestore(source, first.additions);
  assert.equal(second.canRestore, true); assert.equal(second.abandonedSessions, 0);
  assert.deepEqual(second.duplicates, counts(3, 3, 6, 1, 3));
  const priorActive = prepareBackupRestore(source, source);
  assert.deepEqual(priorActive.additions, empty());
  assert.equal(priorActive.abandonedSessions, 0);
  assert.deepEqual(source, before);
});

test('Current profileId data round-trips across all five modules, including both newer games', () => {
  const data = fixture();
  for (const [moduleId, packId] of [['word-connect', 'english3-family'], ['sequence-trail', 'logic3-sequence']]) {
    const pack = copy(BUILTIN_PACKS.find(pack => pack.id === packId));
    if (!data.packs.some(row => row.id === packId)) data.packs.push(pack);
    const session = { ...data.sessions[0], sessionId: `five-${moduleId}`, moduleId, packId, contentVersion: pack.version };
    data.sessions.push(session);
    data.events.push(makeLearningEvent({ ...session, status: 'active' }, pack, {
      attemptKey: 'answer-1', itemId: pack.items[0].id, objectiveId: pack.items[0].objectiveId,
      correct: true, hintsUsed: 0, elapsedMs: 1000,
    }, '2026-10-13T10:00:30.000Z'));
  }
  const restored = parseLearningBackup(serializeLearningBackup(data, exportedAt));
  assert.equal(restored.sessions.length, 5);
  assert.deepEqual(new Set(restored.sessions.map(row => row.moduleId)), new Set(['math-quest', 'memory-match', 'sentence-builder', 'word-connect', 'sequence-trail']));
  assert.equal(restored.events.every(event => event.profileId === 'default-learner'), true);
});

test('Reading a v1 backup preserves legacy attribution and creates a fallback only when needed', () => {
  const legacy = fixture(); legacy.formatVersion = 1;
  for (const key of ['profiles', 'reviews', 'curricula', 'sessionResults', 'lessonProgress']) delete legacy[key];
  legacy.sessions.forEach(session => { delete session.profileId; });
  legacy.events.forEach(event => { delete event.profileId; });
  const parsed = parseLearningBackup(JSON.stringify(legacy));
  assert.equal(parsed.formatVersion, 2); assert.deepEqual(parsed.profiles, []); assert.deepEqual(parsed.reviews, []);
  assert.equal(Object.hasOwn(parsed.sessions[0], 'profileId'), false);
  const plan = prepareBackupRestore(parsed, empty());
  assert.deepEqual(plan.additions.profiles, [{ profileId: 'default-learner', name: 'Bé Học Giỏi', avatar: 'fox', grade: 3,
    colorTheme: 'teal', createdAt: exportedAt, updatedAt: exportedAt }]);
  const reimport = prepareBackupRestore(parsed, plan.additions);
  assert.equal(reimport.counts.profiles, 0); assert.equal(reimport.canRestore, true);
  const known = { ...empty(), profiles: fixture().profiles };
  assert.equal(prepareBackupRestore(parsed, known).counts.profiles, 0);
  const unsupported = { ...legacy, profiles: [] };
  assert.throws(() => validateLearningBackup(unsupported), /phiên bản 1 không hỗ trợ/);
});

test('Snapshot removes volatile tab ownership without mutating stored records or conflicting on reimport', () => {
  const data = fixture(); data.sessions[0].ownerTabId = 'tab-current';
  const before = copy(data);
  const parsed = parseLearningBackup(serializeLearningBackup(data, exportedAt));
  assert.equal(Object.hasOwn(parsed.sessions[0], 'ownerTabId'), false);
  assert.deepEqual(data, before);
  const plan = prepareBackupRestore(parsed, data);
  assert.equal(plan.canRestore, true); assert.equal(plan.duplicates.sessions, 3);
  assert.deepEqual(plan.additions, empty());
  data.sessions[0].status = 'active'; delete data.sessions[0].endedAt;
  const active = prepareBackupRestore(validateLearningBackup(data), empty());
  assert.equal(active.additions.sessions[0].status, 'abandoned');
  assert.equal(Object.hasOwn(active.additions.sessions[0], 'ownerTabId'), false);
  const invalid = fixture(); invalid.sessions[0].ownerTabId = {};
  assert.throws(() => validateLearningBackup(invalid), /tab/);
});

test('Only an untouched default identity ignores device-created timestamps; edited profiles conflict', () => {
  const source = fixture(), current = copy(source);
  current.profiles[0].createdAt = current.profiles[0].updatedAt = '2026-10-14T11:00:00.000Z';
  assert.equal(prepareBackupRestore(source, current).canRestore, true);
  assert.equal(prepareBackupRestore(source, current).duplicates.profiles, 1);
  for (const [key, value] of [['name', 'Bảo An'], ['avatar', 'owl'], ['grade', 4], ['colorTheme', 'blue']]) {
    const edited = copy(current); edited.profiles[0][key] = value;
    assert.deepEqual(prepareBackupRestore(source, edited).conflicts, [{ collection: 'profiles', key: 'default-learner' }]);
  }
  const edited = copy(current); edited.profiles[0].updatedAt = '2026-10-14T11:00:01.000Z';
  assert.equal(prepareBackupRestore(source, edited).canRestore, false);
});

test('Profile boundaries and event attribution are validated while deleted-profile IDs remain intact', () => {
  for (const [key, value] of [['profileId', 'bad id'], ['name', ''], ['name', 'x'.repeat(41)], ['avatar', 'dog'], ['grade', 6], ['colorTheme', ''], ['updatedAt', '2026-10-15T00:00:00Z']]) {
    const data = fixture(); data.profiles[0][key] = value;
    assert.throws(() => validateLearningBackup(data), /Hồ sơ/);
  }
  const mismatch = fixture(); mismatch.events[0].profileId = 'another-learner';
  assert.throws(() => validateLearningBackup(mismatch), /metadata/);
  const legacySession = fixture(); delete legacySession.sessions[0].profileId;
  assert.doesNotThrow(() => validateLearningBackup(legacySession));
  const orphan = fixture(); orphan.profiles = [];
  orphan.sessions.forEach(session => { session.profileId = 'deleted-learner'; });
  orphan.events.forEach(event => { event.profileId = 'deleted-learner'; });
  orphan.reviews.forEach(card => { card.profileId = 'deleted-learner'; card.cardId = `deleted-learner:${card.itemId}`; });
  assert.equal(validateLearningBackup(orphan).events[0].profileId, 'deleted-learner');
  assert.equal(prepareBackupRestore(orphan, empty()).counts.profiles, 0);
});

test('Review cards validate legacy and versioned keys, their graph, dates and finite state', () => {
  const source = fixture();
  source.reviews[0].contentVersion = source.packs[0].version;
  source.reviews[0].cardId = JSON.stringify([source.reviews[0].profileId, source.reviews[0].packId, source.reviews[0].contentVersion, source.reviews[0].itemId]);
  assert.deepEqual(parseLearningBackup(serializeLearningBackup(source, exportedAt)).reviews, source.reviews);
  for (const [key, value] of [['cardId', 'wrong-key'], ['profileId', 'wrong profile'], ['packId', 'missing-pack'], ['itemId', 'missing-item'],
    ['contentVersion', 999], ['repetitions', -1], ['intervalDays', NaN], ['easeFactor', Infinity], ['easeFactor', 1.2], ['lastQuality', 6],
    ['lastReviewedAt', '2026-10-15T00:00:00Z'], ['nextReviewDate', '2026-02-30'], ['nextReviewDate', '2026-10-14T00:00:00Z']]) {
    const data = fixture(); data.reviews[0][key] = value;
    assert.throws(() => validateLearningBackup(data), /Lịch ôn/);
  }
  const accessor = fixture(); let invoked = false;
  Object.defineProperty(accessor.reviews[0], 'lastQuality', { enumerable: true, get() { invoked = true; return 5; } });
  assert.throws(() => validateLearningBackup(accessor), /trường/); assert.equal(invoked, false);
});

test('New collections remain required in v2 and malformed data cannot be silently dropped', () => {
  const parsed = parseLearningBackup(serializeLearningBackup(empty(), exportedAt));
  for (const key of ['curricula', 'sessionResults', 'lessonProgress']) {
    assert.deepEqual(parsed[key], []);
    assert.throws(() => validateLearningBackup({ ...parsed, [key]: [{}] }));
    const missing = copy(parsed); delete missing[key];
    assert.throws(() => validateLearningBackup(missing), /danh sách/);
  }
});

test('V2 round-trip contains all eight collections and enrollment, checkpoint, pass and delayed review sources', () => {
  const data = lessonFixture();
  const parsed = parseLearningBackup(serializeLearningBackup(data, exportedAt));
  assert.deepEqual(parsed, data);
  assert.equal(parsed.lessonProgress[0].progressId, lessonScopeKey(parsed.sessionResults[0].scope));
  assert.equal(parsed.lessonProgress[0].bestStars, 3);
  const plan = prepareBackupRestore(parsed, empty());
  assert.equal(plan.canRestore, true);
  assert.deepEqual(plan.counts, counts(1, 3, 18, 1, 0, 1, 3, 1));
  const retry = prepareBackupRestore(parsed, plan.additions);
  assert.deepEqual(retry.counts, counts());
  assert.deepEqual(retry.duplicates, counts(1, 3, 18, 1, 0, 1, 3, 1));
});

test('New collection keys are unique and curricula/result versions never overwrite conflicting evidence', () => {
  for (const collection of ['curricula', 'sessionResults', 'lessonProgress']) {
    const data = lessonFixture(); data[collection].push(copy(data[collection][0]));
    assert.throws(() => validateLearningBackup(data), /trùng mã/);
  }
  const data = lessonFixture(), current = copy(data);
  current.curricula[0].title = 'Khác nội dung'; current.sessionResults[0].hintsUsed = 1;
  const plan = prepareBackupRestore(data, current);
  assert.equal(plan.canRestore, false);
  assert.deepEqual(plan.conflicts.map(conflict => conflict.collection), ['curricula', 'sessionResults']);
  assert.deepEqual(plan.additions, empty());
});

test('Backup rejects changed stars, missing progression cache and corrupt result/event/profile/coverage graphs', () => {
  const mutations = [
    data => { data.lessonProgress[0].bestStars = 0; },
    data => { data.lessonProgress = []; },
    data => { data.sessionResults[1].firstAttemptCorrect = 5; },
    data => { data.sessionResults[1].scope.lessonRevision = 2; },
    data => { data.sessionResults[2].sourcePassResultId = 'result:missing'; },
    data => { data.sessionResults[1].sourcePracticeResultIds = []; },
    data => { data.events[0].correct = false; },
    data => { data.events[0].profileId = 'foreign'; },
    data => { data.sessionResults[1].coverage[0].answered = 5; },
    data => { data.curricula = []; },
    data => { data.profiles = []; },
    data => { data.profiles[0].learningSettings.enrollments = []; },
    data => { data.sessions[0].checkpoint.receipts[0].eventId = 'missing'; },
    data => { data.sessions[2].startedAt = '2026-10-14T09:00:00.000Z'; },
    data => { data.sessionResults = []; data.lessonProgress = []; },
  ];
  for (const [index, mutate] of mutations.entries()) { const data = lessonFixture(); mutate(data); assert.throws(() => validateLearningBackup(data), `Invalid graph mutation ${index} must be rejected`); }
  const getter = lessonFixture(); let invoked = false;
  Object.defineProperty(getter.sessionResults[0], 'starTier', { enumerable: true, get() { invoked = true; return 3; } });
  assert.throws(() => validateLearningBackup(getter), /trường/); assert.equal(invoked, false);
});

test('Active lesson restore pauses with checkpoint and deadline intact and removes tab ownership', () => {
  const data = lessonFixture();
  data.sessions = [data.sessions[0]]; data.events = data.events.slice(0, 6); data.sessionResults = []; data.lessonProgress = [];
  const session = data.sessions[0]; session.status = 'active'; delete session.endedAt;
  session.ownerTabId = 'tab-live'; session.checkpoint.deadlineAt = '2026-10-13T10:00:00.000Z';
  const parsed = validateLearningBackup(data), plan = prepareBackupRestore(parsed, empty());
  assert.equal(plan.pausedSessions, 1); assert.equal(plan.abandonedSessions, 0);
  const restored = plan.additions.sessions[0]; assert.equal(restored.status, 'paused');
  assert.equal(Object.hasOwn(restored, 'ownerTabId'), false);
  assert.deepEqual(restored.checkpoint, session.checkpoint);
  assert.deepEqual(prepareBackupRestore(parsed, plan.additions).counts, counts());
});

test('Restoring another valid immutable result for an existing scope reconstructs cache and never sums stars', () => {
  const all = lessonFixture(), first = copy(all);
  first.sessions = first.sessions.slice(0, 1); first.events = first.events.slice(0, 6); first.sessionResults = first.sessionResults.slice(0, 1);
  first.lessonProgress = rebuildLessonProgress(first.sessionResults, first.curricula);
  const plan = prepareBackupRestore(all, first);
  assert.equal(plan.canRestore, true); assert.equal(plan.additions.sessionResults.length, 2);
  assert.equal(plan.additions.lessonProgress.length, 1); assert.equal(plan.additions.lessonProgress[0].bestStars, 3);
  assert.equal(plan.additions.lessonProgress[0].resultIds.length, 3);
  assert.equal(plan.duplicates.sessionResults, 1);
  assert.equal(curriculumKey(all.curricula[0]), JSON.stringify(['qa-math3', 1]));
});

test('Paused sessions still require contiguous receipts and verified prerequisite result sources', () => {
  const data = lessonFixture();
  data.sessions = data.sessions.slice(0, 2); data.events = data.events.slice(0, 6); data.sessionResults = data.sessionResults.slice(0, 1);
  data.lessonProgress = rebuildLessonProgress(data.sessionResults, data.curricula);
  const session = data.sessions[1]; session.status = 'paused'; delete session.endedAt;
  session.checkpoint.receipts = []; session.checkpoint.readStepIds = [];
  session.exposureSources = captureExposureSources(session, { results: data.sessionResults, sessions: data.sessions });
  assert.doesNotThrow(() => validateLearningBackup(data));
  const missing = copy(data); missing.sessions[1].sourcePracticeResultIds = ['result:missing'];
  assert.throws(() => validateLearningBackup(missing), /nguồn luyện/);
  const absent = copy(data); absent.sessions[1].sourcePracticeResultIds = [];
  assert.throws(() => validateLearningBackup(absent), /thiếu nguồn luyện/);
  const dangling = copy(data); dangling.sessions[1].checkpoint.receipts.push({ attemptKey: 'new-answer', eventId: 'qa-session-1:new-answer', itemKey: itemRefKey(session.checkpoint.itemOrder[0]), submissionIndex: 1, committedAt: session.startedAt });
  assert.throws(() => validateLearningBackup(dangling), /biên nhận checkpoint/);
  const unordered = copy(data); unordered.events[0].sequence = 2;
  assert.throws(() => validateLearningBackup(unordered), /thứ tự/);
  const missingResult = copy(data); missingResult.sessions[1].exposureSources.resultIds.push('result:unknown');
  assert.throws(() => validateLearningBackup(missingResult), /kết quả nguồn/);
  const missingSession = copy(data); missingSession.sessions[1].exposureSources.sessionIds.push('unknown-session');
  assert.throws(() => validateLearningBackup(missingSession), /phiên nguồn/);
  const foreignKey = copy(data); foreignKey.sessions[1].exposureSources.itemKeys.push(itemRefKey({ packId: 'foreign-pack', contentVersion: 1, itemId: 'foreign-item' }));
  assert.throws(() => validateLearningBackup(foreignKey), /không được chứng minh/);
});

test('Only an untouched default placeholder without learner history is replaced to restore enrollment on a fresh device', () => {
  const source = lessonFixture(), current = empty(); current.profiles = copy(fixture().profiles);
  const before = copy(current), sourceBefore = copy(source);
  const plan = prepareBackupRestore(source, current);
  assert.equal(plan.canRestore, true); assert.equal(plan.seededProfileReplacements, 1);
  assert.deepEqual(plan.replacedSeedProfiles, source.profiles); assert.equal(plan.counts.profiles, 0);
  const restored = { ...plan.additions, profiles: plan.replacedSeedProfiles };
  assert.doesNotThrow(() => validateLearningBackup({ ...restored, schema: BACKUP_SCHEMA, formatVersion: 2, exportedAt }));
  const again = prepareBackupRestore(source, restored);
  assert.equal(again.seededProfileReplacements, 0); assert.equal(again.duplicates.profiles, 1);
  assert.deepEqual(again.counts, counts()); assert.deepEqual(current, before); assert.deepEqual(source, sourceBefore);
  for (const mutate of [
    target => { target.profiles[0].name = 'Đã chỉnh tên'; },
    target => { target.profiles[0].updatedAt = '2026-10-13T11:00:00.000Z'; },
    target => { target.profiles[0].learningSettings = { schemaVersion: 1, enrollments: [], preferredSubjects: [] }; },
    target => { target.sessions = copy(fixture().sessions.slice(0, 1)); },
    target => { target.sessions = copy(fixture().sessions.slice(0, 1)); delete target.sessions[0].profileId; },
    target => { target.events = copy(fixture().events.slice(0, 1)); },
    target => { target.events = copy(fixture().events.slice(0, 1)); delete target.events[0].profileId; },
    target => { target.reviews = copy(fixture().reviews.slice(0, 1)); },
    target => { target.sessionResults = copy(source.sessionResults.slice(0, 1)); },
    target => { target.lessonProgress = copy(source.lessonProgress); },
  ]) {
    const target = copy(current); mutate(target);
    const conflict = prepareBackupRestore(source, target);
    assert.equal(conflict.canRestore, false); assert.equal(conflict.seededProfileReplacements, 0);
    assert.equal(conflict.conflicts.some(row => row.collection === 'profiles'), true);
    assert.deepEqual(conflict.additions, empty());
  }
});

test('Merging isolated-device independent results preserves the exposure basis committed on each original device', () => {
  const deviceA = lessonFixture(), deviceB = copy(deviceA);
  deviceB.sessions = deviceB.sessions.slice(0, 2); deviceB.sessionResults = deviceB.sessionResults.slice(0, 2); deviceB.events = deviceB.events.slice(0, 12);
  const session = deviceB.sessions[1], result = deviceB.sessionResults[1], sessionId = 'qa-device-b-assessment';
  session.sessionId = sessionId; session.startedAt = '2026-10-13T12:00:00.000Z'; session.endedAt = '2026-10-13T12:01:00.000Z'; session.checkpoint.updatedAt = session.endedAt;
  const events = deviceB.events.slice(6).map((event, index) => ({ ...event, sessionId, eventId: `${sessionId}:${event.attemptKey}`, occurredAt: `2026-10-13T12:00:${String(index + 10).padStart(2, '0')}.000Z` }));
  deviceB.events = [...deviceB.events.slice(0, 6), ...events];
  session.checkpoint.receipts = events.map(event => ({ attemptKey: event.attemptKey, eventId: event.eventId, itemKey: itemRefKey(event.itemRef), submissionIndex: event.submissionIndex, committedAt: event.occurredAt }));
  session.exposureSources = captureExposureSources(session, { results: deviceB.sessionResults.slice(0, 1), sessions: deviceB.sessions.slice(0, 1) });
  result.sessionId = sessionId; result.resultId = sessionResultId(sessionId); result.completedAt = session.endedAt; result.eventIds = events.map(event => event.eventId);
  deviceB.lessonProgress = rebuildLessonProgress(deviceB.sessionResults, deviceB.curricula);
  assert.doesNotThrow(() => validateLearningBackup(deviceA)); assert.doesNotThrow(() => validateLearningBackup(deviceB));
  const plan = prepareBackupRestore(deviceB, deviceA);
  assert.equal(plan.canRestore, true); assert.equal(plan.additions.sessionResults.length, 1);
  const merged = { ...deviceA, sessions: [...deviceA.sessions, ...plan.additions.sessions], events: [...deviceA.events, ...plan.additions.events], sessionResults: [...deviceA.sessionResults, ...plan.additions.sessionResults],
    lessonProgress: [...new Map([...deviceA.lessonProgress, ...plan.additions.lessonProgress].map(progress => [progress.progressId, progress])).values()] };
  assert.doesNotThrow(() => validateLearningBackup(merged)); assert.equal(merged.lessonProgress[0].bestStars, 3);
  assert.equal(merged.lessonProgress[0].resultIds.length, 4);
  const replay = copy(merged), importedSession = replay.sessions.find(row => row.sessionId === sessionId);
  importedSession.exposureSources = captureExposureSources(importedSession, { results: replay.sessionResults, sessions: replay.sessions });
  assert.equal(importedSession.exposureSources.resultIds.includes(deviceA.sessionResults[1].resultId), true);
  assert.throws(() => validateLearningBackup(replay), /độc lập/);
});

test('Versioned review evidence round-trips and requires the completed independent source of its marker', () => {
  const data = lessonFixture(), event = data.events.find(event => event.sessionId === 'qa-session-1');
  const evidence = {...event,packId:event.itemRef.packId,contentVersion:event.itemRef.contentVersion,itemId:event.itemRef.itemId};
  const independent = buildReviewUpdate(undefined,evidence,{evidence:'independent'});
  data.reviews = [buildReviewUpdate(independent,{...evidence,sessionId:'later-practice',occurredAt:'2026-10-14T11:02:00.000Z'}, {evidence:'practice'})];
  assert.deepEqual(parseLearningBackup(serializeLearningBackup(data,exportedAt)).reviews,data.reviews);
  for (const mutate of [
    row => { row.lastEvidenceSessionId = 'unknown-session'; },
    row => { row.lastEvidenceSessionId = 'qa-session-0'; },
    row => { row.lastEvidenceDay = '2026-10-12'; },
    row => { row.profileId = 'another-learner'; },
    row => { delete row.lastEvidenceDay; },
    row => { row.contentVersion = 2; },
    row => { row.evidenceKind = 'invented'; },
  ]) {
    const changed=copy(data);mutate(changed.reviews[0]);
    assert.throws(()=>validateLearningBackup(changed),/Lịch ôn/);
  }
  const practice=fixture(); practice.reviews=[buildReviewUpdate(undefined,practice.events[0],{evidence:'practice'})];
  assert.doesNotThrow(()=>validateLearningBackup(practice));
});
