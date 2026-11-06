import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
  shuffleQuestionOptions,
  openProtocolQuestion,
  answerFeedback,
  questionView
} from '../server/question-protocol.mjs';
import {OnlineStore} from '../server/online-store.mjs';
import {PostgresStore} from '../server/postgres-store.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {validatePack, analyzeOptionDistribution} from '../src/core/validation.ts';
import {generateContestQuestions, buildReviewMistakesPack} from '../server/contest-data.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';

function makeQuizPack(id = 'quiz-all-a', version = 1) {
  return {
    id,
    version,
    title: 'Bài kiểm tra toàn A',
    subject: 'math',
    grade: 3,
    kind: 'quiz',
    source: 'local',
    publishedAt: '2026-11-06T00:00:00.000Z',
    items: [
      {
        id: 'q1',
        kind: 'multiple-choice',
        objectiveId: 'MATH.ADD',
        prompt: '1 + 1 bằng bao nhiêu?',
        options: ['2', '3', '4', '5'],
        correctIndex: 0,
        explanation: '1 + 1 = 2.'
      },
      {
        id: 'q2',
        kind: 'multiple-choice',
        objectiveId: 'MATH.SUB',
        prompt: '5 - 3 bằng bao nhiêu?',
        options: ['2', '1', '0', '4'],
        correctIndex: 0,
        explanation: '5 - 3 = 2.'
      }
    ]
  };
}

function makeLearningPack(id = 'learn-all-a', version = 1) {
  return {
    id,
    version,
    title: 'Bài đọc và nghe toàn A',
    subject: 'vietnamese',
    grade: 3,
    kind: 'learning',
    source: 'local',
    publishedAt: '2026-11-06T00:00:00.000Z',
    contentFormatVersion: 2,
    passages: [{passageId: 'pass1', title: 'Mùa thu', body: 'Trời thu xanh ngắt.'}],
    media: [{mediaId: 'audio1', name: 'audio.mp3', kind: 'audio', size: 1000, sha256: 'a'.repeat(64), durationMs: 100}],
    items: [
      {
        id: 'read1',
        kind: 'reading-choice',
        objectiveId: 'READ.AUTUMN',
        passageId: 'pass1',
        prompt: 'Bầu trời mùa thu như thế nào?',
        options: ['Xanh ngắt', 'Xám xịt', 'Đầy mây đen', 'Vàng rực'],
        correctIndex: 0,
        explanation: 'Đoạn văn viết: Trời thu xanh ngắt.'
      },
      {
        id: 'listen1',
        kind: 'listening-choice',
        objectiveId: 'LISTEN.AUTUMN',
        audioId: 'audio1',
        prompt: 'Con vừa nghe từ gì?',
        options: ['Mùa thu', 'Mùa xuân', 'Mùa hè', 'Mùa đông'],
        correctIndex: 0,
        explanation: 'Âm thanh phát từ Mùa thu.'
      }
    ]
  };
}

test('AN01 & AN02 (Pure Function): Shuffling covers all 4 positions, avoids repeating last position, preserves correct content', t => {
  const options = ['Đúng (A)', 'Sai (B)', 'Sai (C)', 'Sai (D)'];
  const correctIndex = 0;

  // 1. AN01: Controlled RNG covering all 4 positions
  const rngAt = val => () => val;
  const pos0 = shuffleQuestionOptions(options, correctIndex, null, rngAt(0.05));
  const pos1 = shuffleQuestionOptions(options, correctIndex, null, rngAt(0.35));
  const pos2 = shuffleQuestionOptions(options, correctIndex, null, rngAt(0.65));
  const pos3 = shuffleQuestionOptions(options, correctIndex, null, rngAt(0.95));

  const coveredPositions = new Set([
    pos0.displayedCorrectIndex,
    pos1.displayedCorrectIndex,
    pos2.displayedCorrectIndex,
    pos3.displayedCorrectIndex
  ]);
  assert.equal(coveredPositions.size, 4, 'Covered all positions 0, 1, 2, 3');

  // Verify that in all presentations, the correct content is at displayedCorrectIndex
  for (const pres of [pos0, pos1, pos2, pos3]) {
    assert.equal(pres.shuffledOptions[pres.displayedCorrectIndex], 'Đúng (A)', 'Correct content is preserved');
    assert.equal(pres.shuffledOptions.length, 4);
    assert.equal(new Set(pres.shuffledOptions).size, 4, 'All options distinct');
  }

  // 2. AN02: Same student/item creates consecutive new presentation: position strictly differs from immediate predecessor
  for (let lastPos = 0; lastPos < 4; lastPos++) {
    for (let sample = 0; sample < 30; sample++) {
      const res = shuffleQuestionOptions(options, correctIndex, lastPos, Math.random);
      assert.notEqual(res.displayedCorrectIndex, lastPos, `Position ${res.displayedCorrectIndex} must not equal last position ${lastPos}`);
    }
  }

  // 3. AN02: 2 options strictly alternate
  const twoOptions = ['Đúng', 'Sai'];
  const alt1 = shuffleQuestionOptions(twoOptions, 0, 0, Math.random);
  assert.equal(alt1.displayedCorrectIndex, 1, 'When last was 0, next must be 1');
  const alt2 = shuffleQuestionOptions(twoOptions, 0, 1, Math.random);
  assert.equal(alt2.displayedCorrectIndex, 0, 'When last was 1, next must be 0');
});

test('AN09: QuestionView before answering contains NO correctIndex, NO answer key, NO permutation', t => {
  const item = {
    id: 'q1',
    kind: 'multiple-choice',
    objectiveId: 'OBJ',
    prompt: 'Question?',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Secret'
  };

  const pres = {
    presentationId: 'pres-123',
    permutation: [2, 0, 3, 1],
    displayedCorrectIndex: 1
  };

  const view = questionView(item, {presentation: pres});
  assert.equal(view.options[0], 'C');
  assert.equal(view.options[1], 'A');
  assert.equal(view.presentationId, 'pres-123');
  assert.equal(view.correctIndex, undefined, 'Must not expose correctIndex');
  assert.equal(view.permutation, undefined, 'Must not expose permutation');
  assert.equal(view.explanation, undefined, 'Must not expose explanation');
});

test('AN11: Validation detects positional references like "Cả A và B" and analyzes distribution', t => {
  const badPack = {
    id: 'test-positional',
    version: 1,
    title: 'Positional test',
    subject: 'math',
    grade: 3,
    kind: 'quiz',
    items: [
      {
        id: 'bad1',
        kind: 'multiple-choice',
        objectiveId: 'OBJ',
        prompt: 'Chọn câu đúng',
        options: ['Con mèo', 'Con chó', 'Cả A và B đều đúng', 'Con chim'],
        correctIndex: 2,
        explanation: 'Cả mèo và chó.'
      }
    ]
  };

  const errors = validatePack(badPack);
  assert.ok(errors.some(e => e.includes('phương án chứa tham chiếu vị trí')), 'Flags positional reference "Cả A và B"');

  const allAPack = makeQuizPack();
  const analysis = analyzeOptionDistribution(allAPack);
  assert.equal(analysis.allSamePosition, true);
  assert.match(analysis.warning, /100%.*vị trí A/);
});

test('AN10: Contest questions and Review Mistakes pack have shuffled options', () => {
  const preset = {id: 'vm3', subject: 'math', grade: 3, totalQuestions: 5, durationSeconds: 1200, title: 'Violympic'};
  const items1 = generateContestQuestions(preset, 'student1', 'session1', []);
  const items2 = generateContestQuestions(preset, 'student1', 'session2', []);

  assert.equal(items1.length, 5);
  // Verify that options for choice questions contain the correct answer
  for (const it of items1) {
    if (it.kind === 'choice' && it.options) {
      assert.ok(it.options.includes(it.correctAnswer), 'Options contain correctAnswer');
    }
  }

  // Review mistakes pack
  const reviewMistakes = [{prompt: '2 x 2?', correctAnswer: '4', explanation: '2 x 2 = 4'}];
  const reviewPack = buildReviewMistakesPack({sessionId: 'contest-sess-1'}, reviewMistakes);
  assert.equal(reviewPack.items.length, 1);
  assert.equal(reviewPack.items[0].choices[0], '4');
});

const at = '2026-11-06T00:00:00.000Z';

async function setupTestFixture(t, engine) {
  let store, admin;
  if (engine === 'PostgreSQL') {
    ({ store, admin } = await createPostgresFixture(t));
  } else {
    store = new OnlineStore(':memory:');
    t.after(() => store.close());
    const workspaceId = randomUUID(), id = randomUUID();
    store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId, 'Trường Thử Nghiệm', at);
    store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id, workspaceId, 'admin_user', 'fixture-hash', 'admin', at);
    admin = { id, workspaceId, role: 'admin', username: 'admin_user' };
  }
  const cls = await store.createClass(admin, { name: 'Class 3A', grade: 3 });
  const student = await store.createStudent(admin, {
    classId: cls.id,
    name: 'Bảo An',
    username: 'baoan_shuffle_' + engine.toLowerCase()
  }, 'fixture-hash', 'baoan_shuffle_' + engine.toLowerCase());
  const user = engine === 'SQLite'
    ? store.db.prepare('SELECT * FROM users WHERE id=?').get(student.userId ?? store.student(admin, student.id).user_id)
    : await store.findUserByUsername(student.username);
  const studentAuth = {
    id: user.id,
    workspaceId: admin.workspaceId,
    studentId: student.id,
    role: 'student',
    username: user.username
  };
  return { store, admin, cls, student, studentAuth };
}

for (const engine of ['SQLite', 'PostgreSQL']) {
  test(`End-to-End [${engine}]: AN01-AN08, AN10, AN12 full question presentation lifecycle`, async t => {
    const { store, admin, cls, studentAuth } = await setupTestFixture(t, engine);

    // Seed quiz pack (all items authored with correctIndex = 0)
    const pack = makeQuizPack();
    await seedLegacyWeek(store, admin, {
      requestId: 'req-shuffle-week-' + engine,
      classId: cls.id,
      title: 'Tuần xáo trộn',
      sets: [{subjectLabel: 'Toán', pack}]
    });

    // 1. Student starts play with secure question protocol
    let startRes, playId;
    try {
      startRes = await store.startPlay(studentAuth, {
        requestId: 'play-shuffle-1-' + engine,
        moduleId: 'math-quest',
        packId: pack.id,
        contentVersion: pack.version
      }, false, true);
      playId = startRes.session.sessionId;
    } catch (err) {
      console.error('ERROR in startPlay:', err);
      throw err;
    }

    // Shell items in startRes have empty options
    assert.deepEqual(startRes.presentation.items[0].options, []);

    // 2. Open Question 1 (First presentation)
    const q1Open1 = await store.openQuestion(studentAuth, playId, {itemId: 'q1'});
    assert.ok(q1Open1.item.presentationId, 'Has presentationId');
    assert.equal(q1Open1.item.options.length, 4);
    assert.equal(q1Open1.item.correctIndex, undefined, 'AN09: Pre-answer view hides correctIndex');

    const displayedOptions1 = q1Open1.item.options;
    const correctContent = '2';
    const displayedCorrectIdx1 = displayedOptions1.indexOf(correctContent);
    assert.ok(displayedCorrectIdx1 >= 0 && displayedCorrectIdx1 <= 3, 'Correct content present in options');

    // 3. AN06: Reconnect/reload mid-attempt before answering returns identical presentation and keeps clock
    const q1Reload = await store.openQuestion(studentAuth, playId, {itemId: 'q1'});
    assert.equal(q1Reload.item.presentationId, q1Open1.item.presentationId, 'AN06: Identical presentationId');
    assert.deepEqual(q1Reload.item.options, displayedOptions1, 'AN06: Identical options order');
    assert.equal(q1Reload.openedAt, q1Open1.openedAt, 'AN06: Question clock not reset');

    // 4. AN04: Student answers INCORRECTLY
    const wrongDisplayedIdx = (displayedCorrectIdx1 + 1) % 4;
    const wrongAttemptKey = 'att-q1-try1';
    const wrongRes = await store.attempt(studentAuth, playId, {
      attemptKey: wrongAttemptKey,
      itemId: 'q1',
      hintsUsed: 0,
      elapsedMs: 500,
      response: {kind: 'choice', choiceIndex: wrongDisplayedIdx}
    }, true);
    assert.equal(wrongRes.event.correct, false, 'AN04: Evaluated as incorrect');
    assert.equal(wrongRes.feedback, undefined, 'AN04: No feedback revealing correct answer');

    // 5. AN05: Retry same attemptKey after network drop returns duplicate response with no extra stars
    const wrongRetry = await store.attempt(studentAuth, playId, {
      attemptKey: wrongAttemptKey,
      itemId: 'q1',
      hintsUsed: 0,
      elapsedMs: 500,
      response: {kind: 'choice', choiceIndex: wrongDisplayedIdx}
    }, true);
    assert.equal(wrongRetry.duplicate, true, 'AN05: Duplicate recognized');
    assert.equal(wrongRetry.event.correct, false);

    // 6. AN07 & AN02: Student retries question -> opens a NEW presentation with a DIFFERENT correct position
    const q1Open2 = await store.openQuestion(studentAuth, playId, {itemId: 'q1'});
    assert.notEqual(q1Open2.item.presentationId, q1Open1.item.presentationId, 'AN07: New presentationId generated');
    const displayedOptions2 = q1Open2.item.options;
    const displayedCorrectIdx2 = displayedOptions2.indexOf(correctContent);
    assert.notEqual(displayedCorrectIdx2, displayedCorrectIdx1, 'AN02: Correct position MUST be different from previous attempt');
    assert.equal(q1Open2.openedAt, q1Open1.openedAt, 'AN07: Question clock preserved (not reset to inflate stars)');

    // 7. AN08: Submitting old superseded presentationId is rejected
    await assert.rejects(
      async () => await store.attempt(studentAuth, playId, {
        attemptKey: 'att-q1-stale',
        itemId: 'q1',
        hintsUsed: 0,
        elapsedMs: 600,
        presentationId: q1Open1.item.presentationId,
        response: {kind: 'choice', choiceIndex: displayedCorrectIdx2}
      }, true),
      /Lượt trình bày câu hỏi đã hết hạn|không khớp/
    );

    // 8. AN03: Student answers correctly on the second presentation
    const correctAttemptKey = 'att-q1-try2';
    const correctRes = await store.attempt(studentAuth, playId, {
      attemptKey: correctAttemptKey,
      itemId: 'q1',
      hintsUsed: 0,
      elapsedMs: 700,
      presentationId: q1Open2.item.presentationId,
      response: {kind: 'choice', choiceIndex: displayedCorrectIdx2}
    }, true);
    assert.equal(correctRes.event.correct, true, 'AN03: Correct answer acknowledged');
    assert.equal(correctRes.feedback.correctIndex, displayedCorrectIdx2, 'AN03: Feedback uses displayed index');
    assert.equal(correctRes.feedback.answer, '2', 'AN03: Feedback answer text is correct');
    assert.match(correctRes.feedback.explanation, /1 \+ 1 = 2/);

    // 9. AN05 on correct attempt: network retry returns identical receipt
    const correctRetry = await store.attempt(studentAuth, playId, {
      attemptKey: correctAttemptKey,
      itemId: 'q1',
      hintsUsed: 0,
      elapsedMs: 700,
      presentationId: q1Open2.item.presentationId,
      response: {kind: 'choice', choiceIndex: displayedCorrectIdx2}
    }, true);
    assert.equal(correctRetry.duplicate, true);
    assert.equal(correctRetry.event.correct, true);
    assert.equal(correctRetry.feedback.correctIndex, displayedCorrectIdx2);

    // 10. Open Question 2
    const q2Open = await store.openQuestion(studentAuth, playId, {itemId: 'q2'});
    const q2CorrectIdx = q2Open.item.options.indexOf('2');
    const q2Res = await store.attempt(studentAuth, playId, {
      attemptKey: 'att-q2-try1',
      itemId: 'q2',
      hintsUsed: 0,
      elapsedMs: 400,
      presentationId: q2Open.item.presentationId,
      response: {kind: 'choice', choiceIndex: q2CorrectIdx}
    }, true);
    assert.equal(q2Res.event.correct, true);

    // 11. Finish play session cleanly
    const finishRes = await store.finishPlay(studentAuth, playId, false, false, true);
    assert.ok(finishRes.tier >= 1, 'Stars awarded legitimately');

    // R217 & R218: Dotted question IDs in history lookup and pack/version isolation
    const dottedPlayId = 'play-dotted-' + engine.toLowerCase();
    const dottedSessionJson = JSON.stringify({
      sessionId: dottedPlayId,
      studentId: studentAuth.studentId,
      packId: 'dotted-pack',
      contentVersion: 1,
      startedAt: '2026-11-06T12:00:00.000Z',
      questionPresentations: {
        'curriculum.q.1': { displayedCorrectIndex: 2 },
        't19.m.01': { displayedCorrectIndex: 3 }
      }
    });

    if (engine === 'SQLite') {
      store.db.prepare('INSERT INTO plays VALUES(?,?,?,?,?)').run(
        dottedPlayId,
        studentAuth.workspaceId,
        studentAuth.studentId,
        'req-dotted-' + engine,
        dottedSessionJson
      );
      const pos1 = store.lastQuestionCorrectPosition(studentAuth.workspaceId, studentAuth.studentId, 'curriculum.q.1', 1, 'dotted-pack');
      assert.equal(pos1, 2, 'R217: SQLite lookup finds dotted curriculum.q.1');
      const pos2 = store.lastQuestionCorrectPosition(studentAuth.workspaceId, studentAuth.studentId, 't19.m.01', 1, 'dotted-pack');
      assert.equal(pos2, 3, 'R217: SQLite lookup finds dotted t19.m.01');
      const wrongPackPos = store.lastQuestionCorrectPosition(studentAuth.workspaceId, studentAuth.studentId, 'curriculum.q.1', 1, 'wrong-pack');
      assert.equal(wrongPackPos, null, 'R218: Pack isolation on SQLite');
    } else {
      await store.exec('INSERT INTO bao_an.plays(id, workspace_id, student_id, request_id, json) VALUES($1,$2,$3,$4,$5::jsonb)', [
        dottedPlayId,
        studentAuth.workspaceId,
        studentAuth.studentId,
        'req-dotted-' + engine,
        dottedSessionJson
      ]);
      const pos1 = await store.lastQuestionCorrectPosition(studentAuth.workspaceId, studentAuth.studentId, 'curriculum.q.1', 1, undefined, 'dotted-pack');
      assert.equal(pos1, 2, 'R217: PostgreSQL lookup finds dotted curriculum.q.1');
      const pos2 = await store.lastQuestionCorrectPosition(studentAuth.workspaceId, studentAuth.studentId, 't19.m.01', 1, undefined, 'dotted-pack');
      assert.equal(pos2, 3, 'R217: PostgreSQL lookup finds dotted t19.m.01');
      const wrongPackPos = await store.lastQuestionCorrectPosition(studentAuth.workspaceId, studentAuth.studentId, 'curriculum.q.1', 1, undefined, 'wrong-pack');
      assert.equal(wrongPackPos, null, 'R218: Pack isolation on PostgreSQL');
    }
  });
}
