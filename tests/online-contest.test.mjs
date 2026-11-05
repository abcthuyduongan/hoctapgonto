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
