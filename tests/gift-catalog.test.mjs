import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {OnlineStore} from '../server/online-store.mjs';
import {createPostgresFixture, authFor} from './helpers/postgres-fixture.mjs';

const at = '2026-11-23T00:00:00.000Z';

function pack(id, n = 2) {
  return {
    id,
    version: 1,
    title: 'Bộ ' + id,
    subject: 'thinking',
    grade: 3,
    kind: 'quiz',
    source: 'local',
    publishedAt: at,
    items: Array.from({length: n}, (_, i) => ({
      id: `q${i}`,
      kind: 'multiple-choice',
      objectiveId: 'TEST.GOAL',
      prompt: `${id}: câu hỏi ${i}`,
      options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
      correctIndex: 0,
      explanation: 'Giải thích',
      metadata: {
        knowledgeId: 'TEST.GOAL',
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
    ({store, admin} = await createPostgresFixture(t));
  } else {
    store = new OnlineStore(':memory:');
    t.after(() => store.close());
    const workspaceId = randomUUID(), id = randomUUID();
    store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId, 'Trường Thử Nghiệm', at);
    store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id, workspaceId, 'admin_user', 'fixture-hash', 'admin', at);
    admin = {id, workspaceId, role: 'admin', username: 'admin_user'};
  }
  const cls = await store.createClass(admin, {name: 'Lớp 3A', grade: 3});
  const publishedWeek = await store.publishWeek(admin, {
    requestId: randomUUID(),
    classId: cls.id,
    title: 'Tuần học chuẩn',
    sets: [
      {subjectLabel: 'Toán', pack: pack('math-g', 4)},
      {subjectLabel: 'Tiếng Việt', pack: pack('viet-g', 4)},
      {subjectLabel: 'Tiếng Anh', pack: pack('eng-g', 4)},
    ]
  });
  return {store, admin, cls, publishedWeek};
}

async function createStudentWithStars(f, engine, username, starTarget = 30) {
  const student = await f.store.createStudent(f.admin, {
    classId: f.cls.id,
    name: 'Bé ' + username,
    username
  }, 'fixture-hash', username);

  const user = engine === 'SQLite'
    ? f.store.db.prepare('SELECT * FROM users WHERE id=?').get(student.userId ?? f.store.student(f.admin, student.id).user_id)
    : await f.store.findUserByUsername(username);

  const auth = engine === 'SQLite'
    ? {id: user.id, workspaceId: f.admin.workspaceId, studentId: student.id, role: 'student', username}
    : authFor(user);

  await f.store.ensureJourney(auth);

  // If starTarget > 0, give student stars via plays on publishedWeek
  if (starTarget > 0) {
    for (const set of f.publishedWeek.sets) {
      const play = await f.store.startPlay(auth, {
        requestId: randomUUID(),
        moduleId: 'math-quest',
        packId: set.pack.id,
        contentVersion: 1
      }, true);
      for (const item of set.pack.items) {
        await f.store.openQuestion(auth, play.session.sessionId, {itemId: item.id});
        await f.store.attempt(auth, play.session.sessionId, {
          attemptKey: item.id,
          itemId: item.id,
          response: {kind: 'choice', choiceIndex: 0},
          hintsUsed: 0,
          elapsedMs: 100
        });
      }
    }
  }

  return {student, auth};
}

for (const engine of ['SQLite', 'PostgreSQL']) {
  test(`${engine}: Admin CRUD gifts, toggles active, and respects class scope`, async t => {
    const f = await fixture(t, engine);

    // 1. Create gift
    const created = await f.store.createGift(f.admin, {
      title: 'Hộp bút màu',
      priceStars: 15,
      kind: 'item',
      stock: 10,
      weeklyLimit: 2,
      unlockAfterWeek: 0,
      classId: f.cls.id,
      imageMediaId: null
    });
    assert.equal(created.title, 'Hộp bút màu');
    assert.equal(created.priceStars, 15);
    assert.equal(created.stock, 10);
    assert.equal(created.weeklyLimit, 2);
    assert.equal(created.active, true);

    // 2. Read gifts
    const list = await f.store.gifts(f.admin, f.cls.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, created.id);

    // 3. Update gift
    const updated = await f.store.updateGift(f.admin, created.id, {
      stock: 8,
      title: 'Hộp bút màu 24 chiếc'
    });
    assert.equal(updated.stock, 8);
    assert.equal(updated.title, 'Hộp bút màu 24 chiếc');

    // 4. Toggle active
    const deactivated = await f.store.updateGift(f.admin, created.id, {active: false});
    assert.equal(deactivated.active, false);

    // When inactive, student does not see it
    const {auth} = await createStudentWithStars(f, engine, 'child-test-1', 0);
    const studentGifts = await f.store.gifts(auth, f.cls.id);
    assert.equal(studentGifts.some(g => g.id === created.id), false);

    // Re-activate
    await f.store.updateGift(f.admin, created.id, {active: true});
    const rechecked = await f.store.gifts(auth, f.cls.id);
    assert.equal(rechecked.some(g => g.id === created.id), true);
  });

  test(`${engine}: Student pins goal, and goal is reflected in summary`, async t => {
    const f = await fixture(t, engine);
    const {auth} = await createStudentWithStars(f, engine, 'goal-child', 0);

    const gift = await f.store.createGift(f.admin, {
      title: 'Vé xem phim cuối tuần',
      priceStars: 20,
      kind: 'experience',
      stock: 5,
      weeklyLimit: 1
    });

    // Initially no goal
    const initGoal = await f.store.studentGoal(auth);
    assert.equal(initGoal, null);

    // Pin goal
    const pinned = await f.store.setStudentGoal(auth, gift.id);
    assert.equal(pinned.giftId, gift.id);
    assert.equal(pinned.gift?.title, 'Vé xem phim cuối tuần');

    // Check studentGoal
    const currentGoal = await f.store.studentGoal(auth);
    assert.ok(currentGoal);
    assert.equal(currentGoal.giftId, gift.id);
    assert.equal(currentGoal.gift?.priceStars, 20);

    // Check studentSummary includes goal
    const summary = await f.store.studentSummary(auth);
    assert.ok(summary.goal);
    assert.equal(summary.goal.giftId, gift.id);
  });

  test(`${engine}: Redemption enforces star balance, decrements stock, and updates wallet`, async t => {
    const f = await fixture(t, engine);
    const {auth} = await createStudentWithStars(f, engine, 'redeem-child', 24);

    const gift = await f.store.createGift(f.admin, {
      title: 'Sách tranh khoa học',
      priceStars: 10,
      kind: 'item',
      stock: 3,
      weeklyLimit: 5
    });

    const summaryBefore = await f.store.studentSummary(auth);
    const initialAvailable = summaryBefore.balance.available;
    assert.ok(initialAvailable >= 10, 'Student should have earned at least 10 stars');

    // Redeem gift
    const req = await f.store.redeemGift(auth, {
      requestId: 'req-gift-1',
      giftId: gift.id
    });
    assert.equal(req.giftId, gift.id);
    assert.equal(req.stars, 10);
    assert.equal(req.kind, 'item');

    // Check updated balance
    const summaryAfter = await f.store.studentSummary(auth);
    assert.equal(summaryAfter.balance.available, initialAvailable - 10);
    assert.equal(summaryAfter.balance.pending, 10);

    // Verify stock decreased
    const giftsList = await f.store.gifts(f.admin, f.cls.id);
    const updatedGift = giftsList.find(g => g.id === gift.id);
    assert.equal(updatedGift.stock, 2);

    // Verify redemption record exists and has giftId
    const foundReq = summaryAfter.requests.find(r => r.requestId === 'req-gift-1');
    assert.ok(foundReq);
    assert.equal(foundReq.giftId, gift.id);
  });

  test(`${engine}: Weekly limit and unlockAfterWeek enforcement`, async t => {
    const f = await fixture(t, engine);
    const {auth} = await createStudentWithStars(f, engine, 'limit-child', 24);

    // 1. Weekly limit test
    const limitedGift = await f.store.createGift(f.admin, {
      title: 'Món quà giới hạn 1 lần/tuần',
      priceStars: 5,
      kind: 'privilege',
      stock: 10,
      weeklyLimit: 1
    });

    // First redemption succeeds
    await f.store.redeemGift(auth, {requestId: 'limit-req-1', giftId: limitedGift.id});

    // Second redemption in same week must fail
    await assert.rejects(
      async () => f.store.redeemGift(auth, {requestId: 'limit-req-2', giftId: limitedGift.id}),
      (err) => /giới hạn/.test(err.message)
    );

    // 2. Unlock after week test
    const futureGift = await f.store.createGift(f.admin, {
      title: 'Món quà tuần 10',
      priceStars: 5,
      kind: 'item',
      stock: 10,
      unlockAfterWeek: 10
    });

    // Student is on week 1, so redeeming futureGift fails with 403
    await assert.rejects(
      async () => f.store.redeemGift(auth, {requestId: 'future-req-1', giftId: futureGift.id}),
      (err) => err.status === 403 && /mở khóa/.test(err.message)
    );
  });

  test(`${engine}: Cancel/Reject restores stock, Fulfill and ConfirmReceived close the loop into Memorial Cabinet`, async t => {
    const f = await fixture(t, engine);
    const {auth} = await createStudentWithStars(f, engine, 'restore-child', 24);

    const gift = await f.store.createGift(f.admin, {
      title: 'Bộ lego mini',
      priceStars: 10,
      kind: 'item',
      stock: 2
    });

    // Redeem: stock 2 -> 1
    await f.store.redeemGift(auth, {requestId: 'restore-req-1', giftId: gift.id});
    let list = await f.store.gifts(f.admin, f.cls.id);
    assert.equal(list.find(g => g.id === gift.id).stock, 1);

    // Student cancels redemption: stock 1 -> 2
    await f.store.transitionReward(auth, 'restore-req-1', {}, true);
    list = await f.store.gifts(f.admin, f.cls.id);
    assert.equal(list.find(g => g.id === gift.id).stock, 2);

    // Redeem again: stock 2 -> 1
    await f.store.redeemGift(auth, {requestId: 'restore-req-2', giftId: gift.id});
    list = await f.store.gifts(f.admin, f.cls.id);
    assert.equal(list.find(g => g.id === gift.id).stock, 1);

    // Admin approves then fulfills
    await f.store.transitionReward(f.admin, 'restore-req-2', {status: 'approved', note: 'Thầy cô đã duyệt'});
    await f.store.transitionReward(f.admin, 'restore-req-2', {status: 'fulfilled', note: 'Đã trao quà'});

    // Student confirms receipt ("Con đã nhận quà")
    const confirmResult = await f.store.confirmReceived(auth, 'restore-req-2');
    assert.ok(confirmResult.receivedAt);
    assert.equal(confirmResult.requestId, 'restore-req-2');

    // Check summary requests has receivedAt
    const summary = await f.store.studentSummary(auth);
    const completedReq = summary.requests.find(r => r.requestId === 'restore-req-2');
    assert.ok(completedReq.receivedAt);
  });

  test(`${engine}: Legacy savings wallet works 100% without loss`, async t => {
    const f = await fixture(t, engine);
    await f.store.configureWallet(f.admin, {enabled: true, rateVnd: 5000});

    const {auth} = await createStudentWithStars(f, engine, 'legacy-wallet-child', 24);
    const summaryBefore = await f.store.studentSummary(auth);
    const starsAvailable = summaryBefore.balance.available;

    // Student requests legacy reward (no giftId)
    const req = await f.store.requestReward(auth, {
      requestId: 'legacy-req-1',
      title: 'Nuôi heo đất 20k',
      goalVnd: 20000
    });

    assert.equal(req.stars, 4); // 20000 / 5000 = 4 stars
    assert.equal(req.amountVnd, 20000);
    assert.equal(req.giftId, undefined);

    const summaryAfter = await f.store.studentSummary(auth);
    assert.equal(summaryAfter.balance.available, starsAvailable - 4);
    assert.equal(summaryAfter.balance.pending, 4);
  });
}

test('PostgreSQL: Concurrency test - 2 students concurrently redeem last stock item -> exactly 1 succeeds and 1 gets 409', async t => {
  const f = await fixture(t, 'PostgreSQL');

  // Create a precious gift with stock = 1
  const gift = await f.store.createGift(f.admin, {
    title: 'Huy chương Vàng duy nhất',
    priceStars: 10,
    kind: 'item',
    stock: 1,
    weeklyLimit: 0
  });

  // Create 2 students in the same class, both with stars
  const s1 = await createStudentWithStars(f, 'PostgreSQL', 'racer-1', 20);
  const s2 = await createStudentWithStars(f, 'PostgreSQL', 'racer-2', 20);

  // Both students attempt to redeem at the exact same instant
  const results = await Promise.allSettled([
    f.store.redeemGift(s1.auth, {requestId: 'race-req-1', giftId: gift.id}),
    f.store.redeemGift(s2.auth, {requestId: 'race-req-2', giftId: gift.id})
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one student should successfully redeem the last item');
  assert.equal(rejected.length, 1, 'Exactly one student should be rejected due to out of stock');

  // Verify the rejected error is 409 and mentions out of stock
  const error = rejected[0].reason;
  assert.equal(error.status, 409);
  assert.match(error.message, /hết hàng/);

  // Verify final stock in database is exactly 0 (never negative!)
  const giftsList = await f.store.gifts(f.admin, f.cls.id);
  const finalGift = giftsList.find(g => g.id === gift.id);
  assert.equal(finalGift.stock, 0);
});
