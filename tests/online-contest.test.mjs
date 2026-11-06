// tests/online-contest.test.mjs
// Kiểm thử Chế độ thi thử Violympic và IOE (Tuần 7 - Cổng C7)

import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineStore } from '../server/online-store.mjs';
import { PostgresStore } from '../server/postgres-store.mjs';
import { createCloudApi } from '../server/cloud-api.mjs';
import { createPostgresFixture } from './helpers/postgres-fixture.mjs';
import {
  CONTEST_PRESETS,
  CONTEST_DISCLAIMER,
  sanitizeContestItem,
  evaluateContestSubmission,
  checkReadinessForExam,
  selectContestQuestions,
  VIOLYMPIC_MATH_POOL,
  IOE_ENGLISH_POOL
} from '../src/core/contest-matrix.ts';

const origin = 'https://contest.example.test';

test('Contest pure functions: sanitization, evaluation, readiness, and seeded shuffle', () => {
  // 1. Sanitize item
  const item = {
    id: 'q1',
    kind: 'choice',
    prompt: '5 x 6 = ?',
    options: ['30', '25', '35', '40'],
    correctAnswer: '30',
    explanation: '5 nhân 6 bằng 30.',
    objectiveId: 'OBJ_MATH'
  };
  const sanitized = sanitizeContestItem(item);
  assert.equal(sanitized.id, 'q1');
  assert.equal(sanitized.prompt, '5 x 6 = ?');
  assert.deepEqual(sanitized.options, ['30', '25', '35', '40']);
  assert.equal(sanitized.correctAnswer, undefined, 'Sanitized item must not expose correctAnswer');
  assert.equal(sanitized.explanation, undefined, 'Sanitized item must not expose explanation');

  // 2. Evaluation
  const preset = CONTEST_PRESETS['violympic-math-g3'];
  const testItems = [
    { id: 'q1', kind: 'choice', prompt: '1+1', options: ['2', '3'], correctAnswer: '2', explanation: '1+1=2' },
    { id: 'q2', kind: 'fill', prompt: '2+2', correctAnswer: '4', explanation: '2+2=4' },
    { id: 'q3', kind: 'choice', prompt: '3+3', options: ['6', '5'], correctAnswer: '6', explanation: '3+3=6' }
  ];
  const answers = { q1: '2', q2: '5', q3: '6' }; // q2 sai
  const result = evaluateContestSubmission(testItems, answers, preset, 60000, 'submitted');
  assert.equal(result.correctCount, 2);
  assert.equal(result.totalItems, 3);
  assert.equal(result.score, 20);
  assert.equal(result.maxScore, 30);
  assert.equal(result.percent, 67);
  assert.equal(result.passed, false);
  assert.equal(result.mistakes.length, 1);
  assert.equal(result.mistakes[0].itemId, 'q2');
  assert.equal(result.mistakes[0].studentAnswer, '5');
  assert.equal(result.mistakes[0].correctAnswer, '4');

  // 3. Readiness check (3 consecutive >= 80%)
  assert.equal(checkReadinessForExam([
    { percent: 85, passed: true },
    { percent: 90, passed: true },
    { percent: 80, passed: true }
  ]).readyForExam, true);

  assert.equal(checkReadinessForExam([
    { percent: 85, passed: true },
    { percent: 75, passed: false }, // ngắt chuỗi
    { percent: 90, passed: true }
  ]).readyForExam, false);

  // 4. Seeded shuffle: identical seeds give identical order, different seeds give different order
  const shuffled1 = selectContestQuestions(VIOLYMPIC_MATH_POOL, 5, 'seed-A');
  const shuffled2 = selectContestQuestions(VIOLYMPIC_MATH_POOL, 5, 'seed-A');
  const shuffled3 = selectContestQuestions(VIOLYMPIC_MATH_POOL, 5, 'seed-B');
  assert.deepEqual(shuffled1.map(q => q.id), shuffled2.map(q => q.id), 'Identical seed must produce identical question order');
  assert.notDeepEqual(shuffled1.map(q => q.id), shuffled3.map(q => q.id), 'Different seeds must produce different question order');
});

test('Contest presets declare at least 1 Violympic Math and 1 IOE English with mandatory disclaimer', () => {
  assert.ok(CONTEST_PRESETS['violympic-math-g3'], 'Must declare Violympic Math preset');
  assert.ok(CONTEST_PRESETS['ioe-english-g3'], 'Must declare IOE English preset');
  assert.equal(CONTEST_PRESETS['violympic-math-g3'].disclaimer, CONTEST_DISCLAIMER);
  assert.equal(CONTEST_PRESETS['ioe-english-g3'].disclaimer, CONTEST_DISCLAIMER);
  assert.equal(CONTEST_DISCLAIMER, 'Đề luyện theo dạng, không phải đề chính thức');
});

test('SQLite Store: Complete contest mock lifecycle, security, zero stars, and readiness milestone', () => {
  const store = new OnlineStore(':memory:');
  const admin = { workspaceId: 'ws-test', id: 'admin-1', role: 'admin' };
  store.db.exec("INSERT INTO workspaces(id,name,wallet_enabled,rate_vnd,created_at) VALUES('ws-test','Trường mẫu',1,1000,'2026-10-01')");
  store.db.exec("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES('u-admin','ws-test','admin','pwd','admin','2026-10-01')");
  const cls = store.createClass(admin, { name: 'Lớp 3A', grade: 3 });
  const s1 = store.createStudent(admin, { classId: cls.id, name: 'Bảo An', username: 'baoan' }, 'pwd', 'baoan');
  const s2 = store.createStudent(admin, { classId: cls.id, name: 'Minh', username: 'minh' }, 'pwd', 'minh');
  const auth1 = { workspaceId: 'ws-test', id: s1.id, studentId: s1.id, role: 'student' };
  const auth2 = { workspaceId: 'ws-test', id: s2.id, studentId: s2.id, role: 'student' };

  // 1. Khởi tạo đề thi thử: đề không được lộ đáp án
  const session1 = store.startContest(auth1, { presetId: 'violympic-math-g3', requestId: 'req-c1' });
  assert.equal(session1.items.length, 15);
  for (const it of session1.items) {
    assert.equal(it.correctAnswer, undefined, 'API must not leak correctAnswer to student');
    assert.equal(it.explanation, undefined, 'API must not leak explanation');
  }

  // 2. Hai học sinh cùng ma trận nhận hai đề khác nhau
  const session2 = store.startContest(auth2, { presetId: 'violympic-math-g3', requestId: 'req-c2' });
  assert.notDeepEqual(session1.items.map(i => i.id), session2.items.map(i => i.id), 'Two students must receive different question selections/order');

  // 3. Tải lại trang (cùng lượt thi) vẫn ra đúng đề cũ
  const resumed = store.startContest(auth1, { presetId: 'violympic-math-g3', requestId: 'req-c1' });
  assert.equal(resumed.sessionId, session1.sessionId);
  assert.deepEqual(resumed.items.map(i => i.id), session1.items.map(i => i.id));

  // 4. Đồng hồ thi tính theo máy chủ: deadlineAt cố định
  assert.ok(session1.remainingSeconds > 0 && session1.remainingSeconds <= 1200);
  assert.equal(session1.deadlineAt, resumed.deadlineAt);

  // 5. Lưu tiến độ bài làm (bỏ qua và chọn đáp án)
  const fullItems = JSON.parse(store.db.prepare('SELECT items_json FROM contest_sessions WHERE session_id=?').get(session1.sessionId).items_json);
  const studentAnswers = {};
  // Làm đúng 13/15 câu (130/150 = 86.7% >= 80% pass)
  for (let i = 0; i < fullItems.length; i++) {
    if (i < 13) {
      studentAnswers[fullItems[i].id] = fullItems[i].correctAnswer;
    } else {
      studentAnswers[fullItems[i].id] = 'đáp_án_sai';
    }
  }
  store.saveContestProgress(auth1, session1.sessionId, { answers: studentAnswers, skippedKeys: [fullItems[14].id] });

  // 6. Nộp bài
  const submitRes = store.submitContest(auth1, session1.sessionId, { answers: studentAnswers });
  assert.equal(submitRes.correctCount, 13);
  assert.equal(submitRes.score, 130);
  assert.equal(submitRes.maxScore, 150);
  assert.equal(submitRes.passed, true);
  assert.equal(submitRes.mistakes.length, 2);
  assert.equal(submitRes.badgeAwarded, true, 'First completed contest must award contestant badge');

  // 7. Thi thử KHÔNG cộng sao vào ví
  const summary = store.studentSummary(auth1);
  assert.equal(summary.balance.earned, 0, 'Contest must not add stars to wallet balance');

  // 8. Huy hiệu "Thí sinh" được lưu trong badge_awards
  const badgeRow = store.db.prepare("SELECT * FROM badge_awards WHERE workspace_id=? AND student_id=? AND badge_id='contestant'").get(auth1.workspaceId, auth1.studentId);
  assert.ok(badgeRow, 'Must have recorded contestant badge');

  // 9. Nút "Ôn các câu sai" tạo gói học liệu từ các câu sai
  const reviewPack = store.contestReviewPack(auth1, session1.sessionId);
  assert.equal(reviewPack.items.length, 2);
  assert.equal(reviewPack.subject, 'math');

  // 10. Tiến trình "Sẵn sàng dự thi": thi thêm 2 lần đạt >= 80%
  // Lần 2:
  const sessB = store.startContest(auth1, { presetId: 'violympic-math-g3', requestId: 'req-c3' });
  const itemsB = JSON.parse(store.db.prepare('SELECT items_json FROM contest_sessions WHERE session_id=?').get(sessB.sessionId).items_json);
  const ansB = {};
  itemsB.forEach(it => { ansB[it.id] = it.correctAnswer; }); // 100%
  const resB = store.submitContest(auth1, sessB.sessionId, { answers: ansB });
  assert.equal(resB.readyForExam, false, 'Need 3 consecutive passes for readiness');

  // Lần 3:
  const sessC = store.startContest(auth1, { presetId: 'violympic-math-g3', requestId: 'req-c4' });
  const itemsC = JSON.parse(store.db.prepare('SELECT items_json FROM contest_sessions WHERE session_id=?').get(sessC.sessionId).items_json);
  const ansC = {};
  itemsC.forEach(it => { ansC[it.id] = it.correctAnswer; }); // 100%
  const resC = store.submitContest(auth1, sessC.sessionId, { answers: ansC });
  assert.equal(resC.readyForExam, true, 'Achieving 3 consecutive >=80% passes must unlock readyForExam milestone');

  // 11. Lịch sử thi trả về đầy đủ
  const history = store.contestHistory(auth1);
  assert.equal(history.attempts.length, 3);
  assert.equal(history.readyForExam, true);
  assert.equal(history.consecutiveCount, 3);
});

test('PostgreSQL Store: Complete contest mock lifecycle, security, zero stars, and readiness milestone', async t => {
  const f = await createPostgresFixture(t);
  const cls = await f.store.createClass(f.admin, { name: 'Lớp 3A', grade: 3 });
  const s1 = await f.store.createStudent(f.admin, { classId: cls.id, name: 'Bảo An', username: 'baoan-pg' }, 'pwd', 'baoan-pg');
  const s2 = await f.store.createStudent(f.admin, { classId: cls.id, name: 'Minh', username: 'minh-pg' }, 'pwd', 'minh-pg');
  const st1 = await f.store.student(f.admin, s1.id);
  const st2 = await f.store.student(f.admin, s2.id);
  const auth1 = { workspaceId: f.admin.workspaceId, id: st1.user_id, studentId: s1.id, role: 'student' };
  const auth2 = { workspaceId: f.admin.workspaceId, id: st2.user_id, studentId: s2.id, role: 'student' };

  // 1. Khởi tạo đề thi thử: đề không được lộ đáp án
  const session1 = await f.store.startContest(auth1, { presetId: 'ioe-english-g3', requestId: 'req-ioe-1' });
  assert.equal(session1.items.length, 15);
  for (const it of session1.items) {
    assert.equal(it.correctAnswer, undefined, 'PostgreSQL: API must not leak correctAnswer');
    assert.equal(it.explanation, undefined, 'PostgreSQL: API must not leak explanation');
  }

  // 2. Hai học sinh cùng ma trận nhận hai đề khác nhau
  const session2 = await f.store.startContest(auth2, { presetId: 'ioe-english-g3', requestId: 'req-ioe-2' });
  assert.notDeepEqual(session1.items.map(i => i.id), session2.items.map(i => i.id), 'PostgreSQL: Two students must receive different questions/order');

  // 3. Tải lại trang (cùng lượt thi) vẫn ra đúng đề cũ
  const resumed = await f.store.startContest(auth1, { presetId: 'ioe-english-g3', requestId: 'req-ioe-1' });
  assert.equal(resumed.sessionId, session1.sessionId);
  assert.deepEqual(resumed.items.map(i => i.id), session1.items.map(i => i.id));

  // 4. Lưu và Nộp bài
  const fullItemsRow = await f.store.one('SELECT items_json FROM bao_an.contest_sessions WHERE session_id=$1', [session1.sessionId]);
  const fullItems = typeof fullItemsRow.items_json === 'string' ? JSON.parse(fullItemsRow.items_json) : fullItemsRow.items_json;
  const answers = {};
  for (let i = 0; i < fullItems.length; i++) {
    answers[fullItems[i].id] = i < 14 ? fullItems[i].correctAnswer : 'wrong';
  }

  await f.store.saveContestProgress(auth1, session1.sessionId, { answers });
  const submitRes = await f.store.submitContest(auth1, session1.sessionId, { answers });
  assert.equal(submitRes.correctCount, 14);
  assert.equal(submitRes.score, 140);
  assert.equal(submitRes.passed, true);
  assert.equal(submitRes.badgeAwarded, true);

  // 5. Không cộng sao vào ví
  const summary = await f.store.studentSummary(auth1);
  assert.equal(summary.balance.earned, 0, 'PostgreSQL: Contest must not grant stars');

  // 6. Ôn câu sai
  const reviewPack = await f.store.contestReviewPack(auth1, session1.sessionId);
  assert.equal(reviewPack.items.length, 1);
  assert.equal(reviewPack.subject, 'english');
});

test('HTTP Cloud API: Endpoints enforce authentication, role check, and hide answers during contest', async t => {
  const f = await createPostgresFixture(t);
  const cls = await f.store.createClass(f.admin, { name: 'Lớp 3A', grade: 3 });
  await f.store.createStudent(f.admin, { classId: cls.id, name: 'An', username: 'an-api' }, 'salt:pwd-hash', 'an-api');

  const api = createCloudApi({ store: f.store, storage: { download: async () => Buffer.from([]) }, publicOrigin: origin });

  // 1. Lấy danh sách preset không cần đăng nhập hoặc có đăng nhập
  const presetRes = await api(new Request(origin + '/api/online/contest/presets'));
  assert.equal(presetRes.status, 200);
  const presets = await presetRes.json();
  assert.ok(Array.isArray(presets));
  assert.ok(presets.some(p => p.id === 'violympic-math-g3'));
  assert.ok(presets.some(p => p.id === 'ioe-english-g3'));

  // 2. Chưa đăng nhập mà gọi start -> 401
  const unauthRes = await api(new Request(origin + '/api/online/contest/start', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetId: 'violympic-math-g3' })
  }));
  assert.equal(unauthRes.status, 401);
});

test('R208-R210: Autosave question-level revision ordering and deadline enforcement on SQLite and PostgreSQL', async t => {
  // SQLite test
  const store = new OnlineStore(':memory:');
  const admin = { workspaceId: 'ws-test-rev', id: 'admin-rev', role: 'admin' };
  store.db.exec("INSERT INTO workspaces(id,name,wallet_enabled,rate_vnd,created_at) VALUES('ws-test-rev','Trường mẫu Rev',1,1000,'2026-10-01')");
  store.db.exec("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES('u-admin-rev','ws-test-rev','admin.rev','pwd','admin','2026-10-01')");
  const cls = store.createClass(admin, { name: 'Lớp 3B', grade: 3 });
  const s = store.createStudent(admin, { classId: cls.id, name: 'Bảo An Rev', username: 'baoan.rev' }, 'salt:pwd', 'baoan.rev');
  const studentUser = store.student(admin, s.id);
  const auth = { workspaceId: admin.workspaceId, id: studentUser.user_id, studentId: s.id, role: 'student' };

  const contest = store.startContest(auth, { presetId: 'violympic-math-g3', requestId: 'rev-c1' });
  const q = contest.items[0];

  // R208: Send revision 2 (answer 'B'), then delayed revision 1 (answer 'A')
  await store.saveContestProgress(auth, contest.sessionId, { answers: { [q.id]: 'Answer-B' }, revision: 2, seq: 2 });
  await store.saveContestProgress(auth, contest.sessionId, { answers: { [q.id]: 'Answer-A' }, revision: 1, seq: 1 });
  const activeAfterStale = store.activeContest(auth);
  assert.equal(activeAfterStale.session.answers[q.id], 'Answer-B', 'Newer revision 2 must win over delayed revision 1');

  // Next revision 3 (answer 'C') must update
  await store.saveContestProgress(auth, contest.sessionId, { answers: { [q.id]: 'Answer-C' }, revision: 3, seq: 3 });
  const activeAfterNewest = store.activeContest(auth);
  assert.equal(activeAfterNewest.session.answers[q.id], 'Answer-C', 'Revision 3 must update over revision 2');

  // R210: Submit on timeout or deadline
  store.db.prepare("UPDATE contest_sessions SET deadline_at = '2020-01-01T00:00:00.000Z' WHERE session_id = ?").run(contest.sessionId);
  const timeoutSave = store.saveContestProgress(auth, contest.sessionId, { answers: { [q.id]: 'Too-Late' }, revision: 4 });
  assert.equal(timeoutSave.status, 'timeout');
  const activeClosed = store.activeContest(auth);
  assert.equal(activeClosed.active, false);

  // PostgreSQL test
  const f = await createPostgresFixture(t);
  const pgCls = await f.store.createClass(f.admin, { name: 'Lớp 3C', grade: 3 });
  const pgS = await f.store.createStudent(f.admin, { classId: pgCls.id, name: 'An PG Rev', username: 'an.pg.rev' }, 'pwd', 'an.pg.rev');
  const pgSt = await f.store.student(f.admin, pgS.id);
  const pgAuth = { workspaceId: f.admin.workspaceId, id: pgSt.user_id, studentId: pgS.id, role: 'student' };

  const pgContest = await f.store.startContest(pgAuth, { presetId: 'violympic-math-g3', requestId: 'pg-rev-c1' });
  const pgQ = pgContest.items[0];

  await f.store.saveContestProgress(pgAuth, pgContest.sessionId, { answers: { [pgQ.id]: 'PG-Answer-B' }, revision: 2, seq: 2 });
  await f.store.saveContestProgress(pgAuth, pgContest.sessionId, { answers: { [pgQ.id]: 'PG-Answer-A' }, revision: 1, seq: 1 });
  const pgActive = await f.store.activeContest(pgAuth);
  assert.equal(pgActive.session.answers[pgQ.id], 'PG-Answer-B', 'PostgreSQL: Newer revision 2 must win over delayed revision 1');

  await f.store.saveContestProgress(pgAuth, pgContest.sessionId, { answers: { [pgQ.id]: 'PG-Answer-C' }, revision: 3, seq: 3 });
  const pgActive3 = await f.store.activeContest(pgAuth);
  assert.equal(pgActive3.session.answers[pgQ.id], 'PG-Answer-C', 'PostgreSQL: Revision 3 must update over revision 2');
});

test('R211-R213: Review pack ownership isolation and prefix authorization checks on SQLite and PostgreSQL', async t => {
  // SQLite test
  const store = new OnlineStore(':memory:');
  const admin = { workspaceId: 'ws-acl', id: 'admin-acl', role: 'admin' };
  store.db.exec("INSERT INTO workspaces(id,name,wallet_enabled,rate_vnd,created_at) VALUES('ws-acl','Trường ACL',1,1000,'2026-10-01')");
  store.db.exec("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES('u-admin-acl','ws-acl','admin.acl','pwd','admin','2026-10-01')");
  const cls = store.createClass(admin, { name: 'Lớp 3D', grade: 3 });
  const sA = store.createStudent(admin, { classId: cls.id, name: 'Học sinh A', username: 'child.a' }, 'salt:pwd', 'child.a');
  const sB = store.createStudent(admin, { classId: cls.id, name: 'Học sinh B', username: 'child.b' }, 'salt:pwd', 'child.b');
  const userA = store.student(admin, sA.id), userB = store.student(admin, sB.id);
  const authA = { workspaceId: admin.workspaceId, id: userA.user_id, studentId: sA.id, role: 'student' };
  const authB = { workspaceId: admin.workspaceId, id: userB.user_id, studentId: sB.id, role: 'student' };

  // A takes contest, submits with mistakes and creates review pack
  const contestA = store.startContest(authA, { presetId: 'violympic-math-g3', requestId: 'req-a-c1' });
  await store.submitContest(authA, contestA.sessionId, { answers: {} });
  const reviewA = store.contestReviewPack(authA, contestA.sessionId);
  assert.ok(reviewA.id.startsWith('review-'));

  // R211: A opens review pack -> allowed
  const playA = store.startPlay(authA, { requestId: 'play-a-rev', moduleId: 'math-quest', packId: reviewA.id, contentVersion: reviewA.version }, true, true);
  assert.ok(playA.session.sessionId);

  // R212: B opens A's review pack -> 403 Forbidden!
  assert.throws(() => {
    store.startPlay(authB, { requestId: 'play-b-rev', moduleId: 'math-quest', packId: reviewA.id, contentVersion: reviewA.version }, true, true);
  }, /chỉ được học gói ôn tập của chính mình/);

  // R213: Teacher pack starting with 'review-' without assignment -> 403 Forbidden!
  const teacherPack = {
    id: 'review-teacher-math',
    version: 1,
    title: 'Gói ôn tập giáo viên',
    kind: 'quiz',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-10-01',
    items: [{ id: 'tq1', kind: 'multiple-choice', objectiveId: 'M1', prompt: '1+1=?', options: ['2','3','4','5'], correctIndex: 0, explanation: '1+1=2' }]
  };
  store.db.prepare("INSERT INTO packs(workspace_id, pack_id, version, subject_label, json, content_hash) VALUES(?,?,?,?,?,?)").run(
    admin.workspaceId, teacherPack.id, teacherPack.version, 'math', JSON.stringify(teacherPack), 'hash-tp'
  );
  assert.throws(() => {
    store.startPlay(authB, { requestId: 'play-b-tp', moduleId: 'math-quest', packId: teacherPack.id, contentVersion: 1 }, true, true);
  }, /chỉ được học bộ câu hỏi thuộc tuần hiện tại/);

  // PostgreSQL test
  const f = await createPostgresFixture(t);
  const pgCls = await f.store.createClass(f.admin, { name: 'Lớp PG ACL', grade: 3 });
  const pgSA = await f.store.createStudent(f.admin, { classId: pgCls.id, name: 'PG Child A', username: 'pg.child.a' }, 'pwd', 'pg.child.a');
  const pgSB = await f.store.createStudent(f.admin, { classId: pgCls.id, name: 'PG Child B', username: 'pg.child.b' }, 'pwd', 'pg.child.b');
  const pgStA = await f.store.student(f.admin, pgSA.id), pgStB = await f.store.student(f.admin, pgSB.id);
  const pgAuthA = { workspaceId: f.admin.workspaceId, id: pgStA.user_id, studentId: pgSA.id, role: 'student' };
  const pgAuthB = { workspaceId: f.admin.workspaceId, id: pgStB.user_id, studentId: pgSB.id, role: 'student' };

  const pgContestA = await f.store.startContest(pgAuthA, { presetId: 'violympic-math-g3', requestId: 'pg-req-a-c1' });
  await f.store.submitContest(pgAuthA, pgContestA.sessionId, { answers: {} });
  const pgReviewA = await f.store.contestReviewPack(pgAuthA, pgContestA.sessionId);
  assert.ok(pgReviewA.id.startsWith('review-'));

  // R211: PG A opens review -> allowed
  const pgPlayA = await f.store.startPlay(pgAuthA, { requestId: 'pg-play-a-rev', moduleId: 'math-quest', packId: pgReviewA.id, contentVersion: pgReviewA.version }, true, true);
  assert.ok(pgPlayA.session.sessionId);

  // R212: PG B opens A's review -> 403 Forbidden!
  await assert.rejects(async () => {
    await f.store.startPlay(pgAuthB, { requestId: 'pg-play-b-rev', moduleId: 'math-quest', packId: pgReviewA.id, contentVersion: pgReviewA.version }, true, true);
  }, /chỉ được học gói ôn tập của chính mình/);
});
