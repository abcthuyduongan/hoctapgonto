import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OnlineStore } from '../server/online-store.mjs';
import { createPostgresFixture, authFor } from './helpers/postgres-fixture.mjs';
import { getVietnamTimeParts } from '../src/core/parent-controls.ts';
import { adminExport } from '../server/admin-data.mjs';

const at = '2026-11-23T00:00:00.000Z';

function makePack(id, subject = 'math', n = 4) {
  return {
    id,
    version: 1,
    title: 'Bộ ' + id,
    subject,
    grade: 3,
    kind: 'quiz',
    source: 'local',
    publishedAt: at,
    items: Array.from({ length: n }, (_, i) => ({
      id: `q${i}`,
      kind: 'multiple-choice',
      objectiveId: 'GOAL.1',
      prompt: `${id}: câu hỏi ${i}`,
      options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
      correctIndex: 0,
      explanation: 'Giải thích',
      metadata: {
        knowledgeId: 'GOAL.1',
        difficulty: 'easy',
        contentRole: 'practice',
        source: 'Mẫu',
        rights: 'Tự soạn',
        reviewStatus: 'draft'
      }
    }))
  };
}

async function fixture(t, engine) {
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
  return { store, admin };
}

async function addStudent(store, admin, clsId, name, uname, engine) {
  const student = await store.createStudent(admin, {
    classId: clsId,
    name,
    username: uname
  }, 'fixture-hash', uname);
  const user = engine === 'SQLite'
    ? store.db.prepare('SELECT * FROM users WHERE id=?').get(student.userId ?? store.student(admin, student.id).user_id)
    : await store.findUserByUsername(uname);
  const studentAuth = engine === 'SQLite'
    ? { id: user.id, workspaceId: admin.workspaceId, studentId: student.id, role: 'student', username: uname }
    : authFor(user);
  return { student, studentAuth };
}

async function recordAttempt(store, auth, playId, itemId, elapsedMs, choiceOption = 0) {
  const openedAt = new Date(Date.now() - elapsedMs).toISOString();
  const receipt = await store.openQuestion(auth, playId, { itemId, openedAt }, true);
  const { pack } = await store.play(auth, playId);
  const item = pack.items.find(i => i.id === itemId);
  const correctText = item.options ? item.options[item.correctIndex] : null;
  const correctIdx = correctText && receipt.item?.options ? receipt.item.options.indexOf(correctText) : 0;
  let finalIdx;
  if (choiceOption === 'wrong' || choiceOption === 1) {
    finalIdx = (correctIdx + 1) % (receipt.item?.options?.length || 4);
  } else {
    finalIdx = correctIdx;
  }
  return await store.attempt(auth, playId, {
    attemptKey: randomUUID(),
    itemId,
    elapsedMs,
    hintsUsed: 0,
    presentationId: receipt.item?.presentationId,
    response: { kind: 'choice', choiceIndex: finalIdx }
  }, true);
}

for (const engine of ['SQLite', 'PostgreSQL']) {
  test(`${engine}: PIN setup, validation, lockout after 5 failures, and PIN change`, async t => {
    const { store, admin } = await fixture(t, engine);
    const cls = await store.createClass(admin, { name: 'Lớp 3A', grade: 3 });
    const { student, studentAuth } = await addStudent(store, admin, cls.id, 'Bảo An', 'baoan', engine);

    // 1. Initial controls state
    const initial = await store.parentControls(admin, student.id);
    assert.equal(initial.hasPin, false);
    assert.equal(initial.pinHash, undefined);
    assert.equal(initial.maxMinutesPerDay, 0);

    // 2. Setup PIN validation: invalid length rejected
    await assert.rejects(
      async () => await store.setupParentPin(studentAuth, student.id, { pin: '12' }),
      /4 đến 6 chữ số/
    );
    await assert.rejects(
      async () => await store.setupParentPin(studentAuth, student.id, { pin: '1234567' }),
      /4 đến 6 chữ số/
    );

    // 3. Setup valid 4-digit PIN
    const setupRes = await store.setupParentPin(studentAuth, student.id, { pin: '1234' });
    assert.equal(setupRes.success, true);

    const controls = await store.parentControls(admin, student.id);
    assert.equal(controls.hasPin, true);
    assert.equal(controls.pinHash, undefined);

    // 4. Verify PIN: wrong PIN fails
    await assert.rejects(
      async () => await store.verifyParentPin(studentAuth, student.id, '9999'),
      /Sai mã PIN/
    );

    // 5. Verify PIN: correct PIN succeeds
    const verifyRes = await store.verifyParentPin(studentAuth, student.id, '1234');
    assert.equal(verifyRes.success, true);
    assert.ok(verifyRes.parentToken);

    // 6. Test 5 consecutive failures triggers 15-minute lockout
    for (let i = 1; i <= 4; i++) {
      await assert.rejects(
        async () => await store.verifyParentPin(studentAuth, student.id, '0000'),
        /Sai mã PIN/
      );
    }
    // 5th failure: locks PIN
    await assert.rejects(
      async () => await store.verifyParentPin(studentAuth, student.id, '0000'),
      /tạm khóa 15 phút/
    );

    // Subsequent attempt while locked also rejected with 429
    await assert.rejects(
      async () => await store.verifyParentPin(studentAuth, student.id, '1234'),
      /Mã PIN đang bị tạm khóa/
    );

    // 7. Admin can reset / change PIN without old PIN
    await store.setupParentPin(admin, student.id, { pin: '5678' });
    const verifyAfterReset = await store.verifyParentPin(studentAuth, student.id, '5678');
    assert.equal(verifyAfterReset.success, true);

    // 8. Student/Parent changing PIN requires correct old PIN
    await assert.rejects(
      async () => await store.setupParentPin(studentAuth, student.id, { pin: '4321', oldPin: 'wrong' }),
      /Mã PIN cũ không chính xác/
    );
    await store.setupParentPin(studentAuth, student.id, { pin: '4321', oldPin: '5678' });
    const verifyNew = await store.verifyParentPin(studentAuth, student.id, '4321');
    assert.equal(verifyNew.success, true);
  });

  test(`${engine}: Parent creation, linking 1-3 students, and authorization boundaries`, async t => {
    const { store, admin } = await fixture(t, engine);
    const cls = await store.createClass(admin, { name: 'Lớp 3B', grade: 3 });
    const { student: student1 } = await addStudent(store, admin, cls.id, 'An', 'an', engine);
    const { student: student2 } = await addStudent(store, admin, cls.id, 'Bình', 'binh', engine);
    const { student: student3 } = await addStudent(store, admin, cls.id, 'Chi', 'chi', engine);
    const { student: studentOther } = await addStudent(store, admin, cls.id, 'Dũng', 'dung', engine);

    // Linking 0 or >3 students rejected
    await assert.rejects(
      async () => await store.createParent(admin, { name: 'Mẹ An', username: 'parent_an', password: 'password123', studentIds: [] }, 'hash', 'parent_an'),
      /1 đến 3 học sinh/
    );
    await assert.rejects(
      async () => await store.createParent(admin, { name: 'Mẹ An', username: 'parent_an', password: 'password123', studentIds: [student1.id, student2.id, student3.id, studentOther.id] }, 'hash', 'parent_an'),
      /1 đến 3 học sinh/
    );

    // Link 2 students
    const parentAccount = await store.createParent(admin, {
      name: 'Mẹ An Bình',
      username: 'parent_an_binh',
      password: 'password123',
      studentIds: [student1.id, student2.id]
    }, 'hash', 'parent_an_binh');

    const parentAuth = {
      id: parentAccount.id,
      workspaceId: admin.workspaceId,
      username: 'parent_an_binh',
      role: 'parent'
    };

    // Parent can query their linked students
    const children = await store.parentStudents(parentAuth);
    assert.equal(children.length, 2);
    assert.ok(children.some(c => c.id === student1.id));
    assert.ok(children.some(c => c.id === student2.id));

    // Parent can access dashboard of linked students
    const dash1 = await store.parentDashboard(parentAuth, student1.id);
    assert.equal(dash1.student.name, 'An');
    assert.equal(dash1.children.length, 2);

    // Parent CANNOT access dashboard of other student (authorization boundary)
    await assert.rejects(
      async () => await store.parentDashboard(parentAuth, studentOther.id),
      /không có quyền xem/
    );
  });

  test(`${engine}: Screen time limits and Curfew hours: startPlay blocked, but in-progress questions save cleanly`, async t => {
    const { store, admin } = await fixture(t, engine);
    const cls = await store.createClass(admin, { name: 'Lớp 3C', grade: 3 });
    const { student, studentAuth } = await addStudent(store, admin, cls.id, 'Bảo An', 'baoan_time', engine);

    const p1 = makePack('pack-time', 'math', 2);
    const pViet = makePack('pack-viet', 'vietnamese', 2);
    const pEng = makePack('pack-eng', 'english', 2);
    const week = await store.publishWeek(admin, {
      requestId: randomUUID(),
      classId: cls.id,
      title: 'Tuần 1',
      sets: [
        { pack: p1, subjectLabel: 'Toán' },
        { pack: pViet, subjectLabel: 'Tiếng Việt' },
        { pack: pEng, subjectLabel: 'Tiếng Anh' }
      ]
    });

    // 1. Set curfew: window where current time is outside
    const { hour } = getVietnamTimeParts();
    const startHour = hour >= 12 ? 1 : 14;
    const endHour = hour >= 12 ? 5 : 18;
    await store.updateParentSettings(admin, student.id, {
      maxMinutesPerDay: 0,
      allowedStartHour: startHour,
      allowedEndHour: endHour
    });

    // startPlay rejected due to curfew
    await assert.rejects(
      async () => await store.startPlay(studentAuth, {
        requestId: randomUUID(),
        moduleId: 'math-quest',
        packId: p1.id,
        contentVersion: p1.version
      }, true, true),
      /ngoài khung giờ học được phép/
    );

    // 2. Open curfew to 0h-24h, but set screen time to 10 minutes
    await store.updateParentSettings(admin, student.id, {
      maxMinutesPerDay: 10,
      allowedStartHour: 0,
      allowedEndHour: 24
    });

    // Start play succeeds within limit
    const play = await store.startPlay(studentAuth, {
      requestId: randomUUID(),
      moduleId: 'math-quest',
      packId: p1.id,
      contentVersion: p1.version
    }, true, true);
    assert.ok(play.session.sessionId);

    // 3. Question attempt in-progress: simulate elapsedMs = 15 minutes (900,000 ms)
    const receipt = await recordAttempt(store, studentAuth, play.session.sessionId, 'q0', 900000, 0);
    assert.equal(receipt.event.correct, true);
    await recordAttempt(store, studentAuth, play.session.sessionId, 'q1', 1000, 0);

    // Complete play succeeds and stars are awarded without loss
    const completeRes = await store.finishPlay(studentAuth, play.session.sessionId, false, true, true);
    assert.ok(completeRes.state);

    // 4. Now today's study minutes = 15 mins > 10 mins limit.
    // Starting a NEW play is blocked by screen time limit!
    await assert.rejects(
      async () => await store.startPlay(studentAuth, {
        requestId: randomUUID(),
        moduleId: 'math-quest',
        packId: p1.id,
        contentVersion: p1.version
      }, true, true),
      /đã học đủ thời lượng/
    );
  });

  test(`${engine}: Parent gift approval, fulfillment, and reject refunds stars to child`, async t => {
    const { store, admin } = await fixture(t, engine);
    const cls = await store.createClass(admin, { name: 'Lớp 3D', grade: 3 });
    const { student, studentAuth } = await addStudent(store, admin, cls.id, 'An', 'an_gift', engine);

    const parentAccount = await store.createParent(admin, {
      name: 'Ba An',
      username: 'ba_an',
      password: 'password123',
      studentIds: [student.id]
    }, 'hash', 'ba_an');
    const parentAuth = {
      id: parentAccount.id,
      workspaceId: admin.workspaceId,
      username: 'ba_an',
      role: 'parent'
    };

    // Give student some stars via pack completion
    const p1 = makePack('pack-gift', 'math', 2);
    const pViet = makePack('pack-gift-viet', 'vietnamese', 2);
    const pEng = makePack('pack-gift-eng', 'english', 2);
    await store.publishWeek(admin, {
      requestId: randomUUID(),
      classId: cls.id,
      title: 'Tuần 1',
      sets: [
        { pack: p1, subjectLabel: 'Toán' },
        { pack: pViet, subjectLabel: 'Tiếng Việt' },
        { pack: pEng, subjectLabel: 'Tiếng Anh' }
      ]
    });
    const play = await store.startPlay(studentAuth, {
      requestId: randomUUID(),
      moduleId: 'math-quest',
      packId: p1.id,
      contentVersion: p1.version
    }, true, true);
    await recordAttempt(store, studentAuth, play.session.sessionId, 'q0', 5000, 0);
    await recordAttempt(store, studentAuth, play.session.sessionId, 'q1', 5000, 0);
    await store.finishPlay(studentAuth, play.session.sessionId, false, true, true);

    // Create gift costing 2 stars
    const gift = await store.createGift(admin, {
      title: 'Hộp bút màu',
      priceStars: 2,
      kind: 'item',
      stock: 5,
      classId: cls.id
    });

    // Student redeems gift: stars move from available to pending
    const initialSummary = await store.studentSummary(studentAuth, '0');
    const prevAvailable = initialSummary.balance.available;
    assert.ok(prevAvailable >= 2);

    const reqId = randomUUID();
    await store.redeemGift(studentAuth, { requestId: reqId, giftId: gift.id });

    const afterRedeem = await store.studentSummary(studentAuth, '0');
    assert.equal(afterRedeem.balance.available, prevAvailable - 2);
    assert.equal(afterRedeem.balance.pending, 2);

    // Parent rejects the gift with note: stars must be refunded back to student!
    await store.transitionReward(parentAuth, reqId, {
      status: 'rejected',
      note: 'Con cố gắng tích thêm sao đổi lego nhé!'
    });

    const afterReject = await store.studentSummary(studentAuth, '0');
    assert.equal(afterReject.balance.available, prevAvailable); // Refunded!
    assert.equal(afterReject.balance.pending, 0);

    // Student redeems again, and parent approves then fulfills
    const reqId2 = randomUUID();
    await store.redeemGift(studentAuth, { requestId: reqId2, giftId: gift.id });
    await store.transitionReward(parentAuth, reqId2, { status: 'approved' });
    await store.transitionReward(parentAuth, reqId2, { status: 'fulfilled' });

    const finalSummary = await store.studentSummary(studentAuth, '0');
    assert.equal(finalSummary.balance.redeemed, 2);
    assert.equal(finalSummary.balance.pending, 0);
  });

  test(`${engine}: Weekly Report metrics match admin Excel export stats 100%`, async t => {
    const { store, admin } = await fixture(t, engine);
    const cls = await store.createClass(admin, { name: 'Lớp 3E', grade: 3 });
    const { student, studentAuth } = await addStudent(store, admin, cls.id, 'Bảo An', 'baoan_rep', engine);

    const pMath = makePack('pack-math', 'math', 2);
    const pViet = makePack('pack-viet', 'vietnamese', 2);
    const pEng = makePack('pack-eng', 'english', 2);

    const week = await store.publishWeek(admin, {
      requestId: randomUUID(),
      classId: cls.id,
      title: 'Tuần 1 Học Tốt',
      sets: [
        { pack: pMath, subjectLabel: 'Toán' },
        { pack: pViet, subjectLabel: 'Tiếng Việt' },
        { pack: pEng, subjectLabel: 'Tiếng Anh' }
      ]
    });

    // Play math: q0 correct on first try, q1 wrong first try then correct
    const playMath = await store.startPlay(studentAuth, { requestId: randomUUID(), moduleId: 'math-quest', packId: pMath.id, contentVersion: 1 }, true, true);
    await recordAttempt(store, studentAuth, playMath.session.sessionId, 'q0', 3000, 0);
    await recordAttempt(store, studentAuth, playMath.session.sessionId, 'q1', 4000, 1); // wrong
    await recordAttempt(store, studentAuth, playMath.session.sessionId, 'q1', 2000, 0); // corrected
    await store.finishPlay(studentAuth, playMath.session.sessionId, false, true, true);

    // Play Vietnamese: both correct first try
    const playViet = await store.startPlay(studentAuth, { requestId: randomUUID(), moduleId: 'math-quest', packId: pViet.id, contentVersion: 1 }, true, true);
    await recordAttempt(store, studentAuth, playViet.session.sessionId, 'q0', 5000, 0);
    await recordAttempt(store, studentAuth, playViet.session.sessionId, 'q1', 5000, 0);
    await store.finishPlay(studentAuth, playViet.session.sessionId, false, true, true);

    // Get Admin export stats
    const exportData = await adminExport(store, admin, week.id);
    assert.equal(exportData.stats[pMath.id]['q0'].firstTryCorrect, 1);
    assert.equal(exportData.stats[pMath.id]['q1'].firstTryCorrect, 0);
    assert.equal(exportData.stats[pViet.id]['q0'].firstTryCorrect, 1);
    assert.equal(exportData.stats[pViet.id]['q1'].firstTryCorrect, 1);

    // Get Parent dashboard report
    const dash = await store.parentDashboard(admin, student.id, week.id);
    const report = dash.report;

    assert.equal(report.studentName, 'Bảo An');
    assert.equal(report.weekTitle, 'Tuần 1 Học Tốt');
    assert.equal(report.totalQuestionsCompleted, 4);

    // Overall first try: 3 of 4 first-try correct = 75%
    assert.equal(report.overallFirstTryAccuracyPct, 75);

    // Verify subject breakdown matches
    const mathSub = report.subjects.find(s => s.subjectLabel === 'Toán');
    assert.ok(mathSub);
    assert.equal(mathSub.questionsAnswered, 2);
    assert.equal(mathSub.firstTryCorrect, 1);
    assert.equal(mathSub.firstTryAccuracyPct, 50);

    const vietSub = report.subjects.find(s => s.subjectLabel === 'Tiếng Việt');
    assert.ok(vietSub);
    assert.equal(vietSub.questionsAnswered, 2);
    assert.equal(vietSub.firstTryCorrect, 2);
    assert.equal(vietSub.firstTryAccuracyPct, 100);

    // Top mistakes should contain math q1 (1 error)
    assert.equal(report.topMistakes.length, 1);
    assert.equal(report.topMistakes[0].itemId, 'q1');
    assert.equal(report.topMistakes[0].errorCount, 1);
  });
}
