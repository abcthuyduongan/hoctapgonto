import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { OnlineStore } from '../server/online-store.mjs';
import { createPostgresFixture } from './helpers/postgres-fixture.mjs';
import { createCloudApi } from '../server/cloud-api.mjs';
import { validateAnimalName, getUnlockedAnimals, ANIMAL_CATALOG } from '../src/core/animal-neighbors.ts';
import { sanitizeClassFeedEvent, verifyPrivacyCompliance } from '../src/core/class-feed.ts';

test('SOCIAL-01: Pure domain logic for animal unlocks and profanity filter', () => {
  // 1. Unlocked animals by completed weeks
  assert.equal(getUnlockedAnimals(0).length, 0);
  assert.equal(getUnlockedAnimals(3).length, 0);
  assert.equal(getUnlockedAnimals(4).length, 1);
  assert.equal(getUnlockedAnimals(4)[0].id, 'rabbit');
  assert.equal(getUnlockedAnimals(8).length, 2);
  assert.equal(getUnlockedAnimals(8)[1].id, 'fox');
  assert.equal(getUnlockedAnimals(12).length, 3);
  assert.equal(getUnlockedAnimals(12)[2].id, 'bear');

  // 2. Profanity filter
  // Blocked names (Vietnamese & English vulgarities)
  assert.equal(validateAnimalName('địt').valid, false);
  assert.equal(validateAnimalName('Địt Mẹ').valid, false);
  assert.equal(validateAnimalName('dkm').valid, false);
  assert.equal(validateAnimalName('clgt').valid, false);
  assert.equal(validateAnimalName('fuck').valid, false);
  assert.equal(validateAnimalName('bitch').valid, false);
  assert.equal(validateAnimalName('ngu').valid, false);
  assert.equal(validateAnimalName('cút').valid, false);

  // Length checks
  assert.equal(validateAnimalName('a').valid, false);
  assert.equal(validateAnimalName('Tên này quá dài vượt qua hai mươi ký tự cho phép').valid, false);

  // Special characters
  assert.equal(validateAnimalName('<script>alert()</script>').valid, false);
  assert.equal(validateAnimalName('Thỏ [Vip]').valid, false);

  // Valid cute names
  const valid1 = validateAnimalName('Thỏ Ngọc');
  assert.equal(valid1.valid, true);
  assert.equal(valid1.cleanName, 'Thỏ Ngọc');

  const valid2 = validateAnimalName('  Cáo Cam Xinh  ');
  assert.equal(valid2.valid, true);
  assert.equal(valid2.cleanName, 'Cáo Cam Xinh');

  const valid3 = validateAnimalName('Bác Gấu Bự');
  assert.equal(valid3.valid, true);
  assert.equal(valid3.cleanName, 'Bác Gấu Bự');
});

test('SOCIAL-02: Class feed event sanitization and strict child privacy verification', () => {
  const safeEvent = sanitizeClassFeedEvent({
    id: 'ev-1',
    classId: 'cls-1',
    studentId: 'st-1',
    studentName: 'Bảo An',
    eventType: 'building_built',
    details: {
      buildingId: 'windmill',
      buildingName: 'Cối Xay Gió',
      buildingIcon: '🌬️',
    },
    createdAt: '2026-11-05T00:00:00.000Z',
  });

  assert.equal(verifyPrivacyCompliance(safeEvent), true);
  assert.equal(safeEvent.studentName, 'Bảo An');
  assert.equal(safeEvent.details.buildingName, 'Cối Xay Gió');

  // An event attempting to leak sensitive info is caught by verifyPrivacyCompliance
  const leakedEvent = {
    ...safeEvent,
    username: 'baoan.child2026',
  };
  assert.equal(verifyPrivacyCompliance(leakedEvent), false);

  const leakedBalanceEvent = {
    ...safeEvent,
    details: {
      ...safeEvent.details,
      balance: 100,
    },
  };
  assert.equal(verifyPrivacyCompliance(leakedBalanceEvent), false);
});

test('SOCIAL-03: SQLite OnlineStore full social workflow (Animals, Visits, Cheers, Feed)', async () => {
  const store = new OnlineStore(':memory:');
  const adminAuth = { workspaceId: 'ws-c9', id: 'admin-1', role: 'admin' };
  store.db.exec("INSERT INTO workspaces(id,name,wallet_enabled,rate_vnd,created_at) VALUES('ws-c9','Trường mẫu C9',1,1000,'2026-10-01')");
  store.db.exec("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES('u-admin','ws-c9','admin.c9','pwd','admin','2026-10-01')");

  // Create 2 classes
  const clsA = store.createClass(adminAuth, { name: 'Lớp 3A', grade: 3 });
  const clsB = store.createClass(adminAuth, { name: 'Lớp 3B', grade: 3 });

  // Create 2 students in Class A and 1 student in Class B
  const st1 = store.createStudent(adminAuth, { classId: clsA.id, name: 'Bảo An', username: 'baoan' }, 'pwd', 'baoan');
  const st2 = store.createStudent(adminAuth, { classId: clsA.id, name: 'Minh Quân', username: 'minhquan' }, 'pwd', 'minhquan');
  const st3 = store.createStudent(adminAuth, { classId: clsB.id, name: 'Linh Nhi', username: 'linhnhi' }, 'pwd', 'linhnhi');

  const authSt1 = { id: st1.id, workspaceId: 'ws-c9', role: 'student', studentId: st1.id };
  const authSt2 = { id: st2.id, workspaceId: 'ws-c9', role: 'student', studentId: st2.id };
  const authSt3 = { id: st3.id, workspaceId: 'ws-c9', role: 'student', studentId: st3.id };

  // 1. Initial animal check (0 completed weeks -> 0 unlocked animals)
  const initialAnimals = store.townAnimals(authSt1, st1.id);
  assert.equal(initialAnimals.completedWeeksCount, 0);
  assert.equal(initialAnimals.animals.length, 0);

  // Attempt to name animal when not unlocked should fail
  assert.throws(
    () => store.nameTownAnimal(authSt1, st1.id, { animalId: 'rabbit', name: 'Bông Gòn' }),
    /chưa chuyển đến thị trấn/
  );

  // Seed 4 completed weeks for st1 to unlock Rabbit
  for (let w = 1; w <= 4; w++) {
    const pId = `pack-w${w}`;
    store.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run('ws-c9', pId, 1, 'Toán', JSON.stringify({ id: pId, subject: 'math', items: [{ id: `q${w}` }] }), `h-${w}`);
    store.db.prepare('INSERT INTO weeks VALUES(?,?,?,?,?,?,?,?)').run(`week-${w}`, 'ws-c9', clsA.id, `Tuần ${w}`, w, `req-w${w}`, `hash-${w}`, '2026-10-01');
    store.db.prepare('INSERT INTO week_sets VALUES(?,?,?,?,?)').run('ws-c9', `week-${w}`, 1, pId, 1);
    store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run(
      'ws-c9', st1.id, pId, 3,
      JSON.stringify({
        packId: pId,
        starTier: 3,
        policyVersion: 2,
        questionLedger: {
          policyVersion: 2,
          packId: pId,
          legacyStars: 0,
          questionTiers: { [`q${w}`]: 3 },
          earnedStars: 3,
        }
      })
    );
  }

  // Now st1 has 4 completed weeks -> Rabbit is unlocked!
  const unlockedAnimals = store.townAnimals(authSt1, st1.id);
  assert.equal(unlockedAnimals.completedWeeksCount, 4);
  assert.equal(unlockedAnimals.animals.length, 1);
  assert.equal(unlockedAnimals.animals[0].animalId, 'rabbit');
  assert.equal(unlockedAnimals.animals[0].name, 'Thỏ Ngọc'); // default name

  // Naming with profanity fails
  assert.throws(
    () => store.nameTownAnimal(authSt1, st1.id, { animalId: 'rabbit', name: 'địt' }),
    /chưa phù hợp/
  );

  // Naming with valid name succeeds
  const nameRes = store.nameTownAnimal(authSt1, st1.id, { animalId: 'rabbit', name: '  Bông Gòn Xinh  ' });
  assert.equal(nameRes.ok, true);
  assert.equal(nameRes.animal.name, 'Bông Gòn Xinh');

  // Animal list now reflects the custom name
  const updatedAnimals = store.townAnimals(authSt1, st1.id);
  assert.equal(updatedAnimals.animals[0].name, 'Bông Gòn Xinh');
  assert.equal(updatedAnimals.animals[0].hasCustomName, true);

  // 2. Classmate town listing
  const classmates = store.classmatesTowns(authSt1, st1.id);
  assert.equal(classmates.length, 2); // st1 and st2 in Class A
  const classmateNames = classmates.map(c => c.name);
  assert.ok(classmateNames.includes('Bảo An'));
  assert.ok(classmateNames.includes('Minh Quân'));
  assert.ok(!classmateNames.includes('Linh Nhi')); // Linh Nhi is in Class B!
  // Verify NO username in classmate items
  for (const c of classmates) {
    assert.equal(c.username, undefined);
  }

  // 3. Visit Classmate Town
  // In same class: st1 visits st2 -> success (read-only)
  const visitSt2 = store.visitTown(authSt1, st1.id, st2.id);
  assert.equal(visitSt2.studentName, 'Minh Quân');
  assert.equal(visitSt2.isSelf, false);
  assert.equal(visitSt2.town.gridWidth, 10);
  assert.equal(visitSt2.cheersCount, 0);

  // Cross-class visit: st1 (Class A) visits st3 (Class B) -> throws 403 Forbidden
  assert.throws(
    () => store.visitTown(authSt1, st1.id, st3.id),
    (err) => err.status === 403
  );

  // 4. Cheer Classmate
  // Self cheer throws 400
  assert.throws(
    () => store.cheerClassmate(authSt1, st1.id, st1.id),
    (err) => err.status === 400
  );

  // Cross-class cheer throws 403
  assert.throws(
    () => store.cheerClassmate(authSt1, st1.id, st3.id),
    (err) => err.status === 403
  );

  // Legitimate cheer: st1 cheers st2
  const cheerResult1 = store.cheerClassmate(authSt1, st1.id, st2.id);
  assert.equal(cheerResult1.ok, true);
  assert.equal(cheerResult1.alreadyCheeredToday, false);
  assert.equal(cheerResult1.cheersCount, 1);

  // Second cheer on the same day is idempotent
  const cheerResult2 = store.cheerClassmate(authSt1, st1.id, st2.id);
  assert.equal(cheerResult2.ok, true);
  assert.equal(cheerResult2.alreadyCheeredToday, true);
  assert.equal(cheerResult2.cheersCount, 1);

  // 5. Class Feed Events & Privacy Check
  const feedA = store.classFeed(adminAuth, clsA.id);
  assert.equal(feedA.enabled, true);
  assert.ok(feedA.events.length >= 1);
  const cheerEvent = feedA.events.find(e => e.eventType === 'cheer_received');
  assert.ok(cheerEvent);
  assert.equal(cheerEvent.studentName, 'Minh Quân');
  assert.equal(verifyPrivacyCompliance(cheerEvent), true);

  // Cross-class feed: Class B has no events
  const feedB = store.classFeed(adminAuth, clsB.id);
  assert.equal(feedB.events.length, 0);

  // Teacher disables feed for Class A
  store.updateClassSettings(adminAuth, clsA.id, { feedEnabled: false });
  const feedADisabled = store.classFeed(adminAuth, clsA.id);
  assert.equal(feedADisabled.enabled, false);
  assert.equal(feedADisabled.events.length, 0);

  // Teacher re-enables feed for Class A
  store.updateClassSettings(adminAuth, clsA.id, { feedEnabled: true });
  const feedAReEnabled = store.classFeed(adminAuth, clsA.id);
  assert.equal(feedAReEnabled.enabled, true);
  assert.ok(feedAReEnabled.events.length >= 1);
});

test('SOCIAL-04: PostgreSQL Store animal naming, town visit, cheer, and feed parity', async (t) => {
  const { store, admin } = await createPostgresFixture(t);

  const cls = await store.createClass(admin, { name: 'Lớp 3A Postgres', grade: 3 });
  const clsOther = await store.createClass(admin, { name: 'Lớp 3B Postgres', grade: 3 });

  const stA = await store.createStudent(admin, { classId: cls.id, name: 'Bảo An PG', username: 'baoan.pg' }, 'pwd', 'baoan.pg');
  const stB = await store.createStudent(admin, { classId: cls.id, name: 'Minh Quân PG', username: 'minhquan.pg' }, 'pwd', 'minhquan.pg');
  const stOther = await store.createStudent(admin, { classId: clsOther.id, name: 'Linh Nhi PG', username: 'linhnhi.pg' }, 'pwd', 'linhnhi.pg');

  const authA = { id: stA.id, workspaceId: admin.workspaceId, role: 'student', studentId: stA.id };

  // 1. Visit classmate town in PostgreSQL
  const visit = await store.visitTown(authA, stA.id, stB.id);
  assert.equal(visit.studentName, 'Minh Quân PG');
  assert.equal(visit.cheersCount, 0);

  // Cross-class visit blocked
  await assert.rejects(
    () => store.visitTown(authA, stA.id, stOther.id),
    (err) => err.status === 403
  );

  // 2. Cheer in PostgreSQL
  const cheer1 = await store.cheerClassmate(authA, stA.id, stB.id);
  assert.equal(cheer1.ok, true);
  assert.equal(cheer1.cheersCount, 1);

  // 3. Class feed in PostgreSQL
  const feed = await store.classFeed(admin, cls.id);
  assert.equal(feed.enabled, true);
  assert.ok(feed.events.length >= 1);
  assert.equal(verifyPrivacyCompliance(feed.events[0]), true);

  // Toggle feed off
  await store.updateClassSettings(admin, cls.id, { feedEnabled: false });
  const feedOff = await store.classFeed(admin, cls.id);
  assert.equal(feedOff.enabled, false);
  assert.equal(feedOff.events.length, 0);
});

test('SOCIAL-05: Cloud API /town and /class-feed endpoints with privacy and role enforcement', async (t) => {
  const { store, admin } = await createPostgresFixture(t);
  const origin = 'https://api.baoan.local';
  const api = createCloudApi({ store, storage: {}, publicOrigin: origin, setupToken: 'tok' });

  const cls = await store.createClass(admin, { name: 'Lớp 3A Cloud', grade: 3 });
  const st1 = await store.createStudent(admin, { classId: cls.id, name: 'Bảo An Cloud', username: 'baoan.cloud' }, 'pwd', 'baoan.cloud');
  const st2 = await store.createStudent(admin, { classId: cls.id, name: 'Minh Quân Cloud', username: 'minhquan.cloud' }, 'pwd', 'minhquan.cloud');

  const pupilRow = await store.student(admin, st1.id);
  const sessionToken = '1234567890123456789012345678901234567890123456789012345678901234';
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const csrf = 'csrf-test-token-c9';

  await store.createSession({
    tokenHash,
    userId: pupilRow.user_id,
    csrfToken: csrf,
    expiresAt: Date.now() + 3600000,
    passwordHash: 'pwd',
    workspaceId: admin.workspaceId,
  });

  const studentHeaders = {
    Cookie: `baoan_online_session=${sessionToken}`,
    'X-CSRF-Token': csrf,
    Origin: origin,
    'Content-Type': 'application/json',
  };

  // 1. GET /town/classmates
  const classmatesRes = await api(new Request(origin + '/api/online/town/classmates', {
    method: 'GET',
    headers: studentHeaders,
  }));
  assert.equal(classmatesRes.status, 200);
  const classmatesData = await classmatesRes.json();
  assert.ok(Array.isArray(classmatesData));
  assert.equal(classmatesData.length, 2);

  // 2. GET /town/visit?studentId=...
  const visitRes = await api(new Request(origin + `/api/online/town/visit?studentId=${st2.id}`, {
    method: 'GET',
    headers: studentHeaders,
  }));
  assert.equal(visitRes.status, 200);
  const visitData = await visitRes.json();
  assert.equal(visitData.studentName, 'Minh Quân Cloud');

  // 3. POST /town/cheer
  const cheerRes = await api(new Request(origin + '/api/online/town/cheer', {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ targetStudentId: st2.id }),
  }));
  assert.equal(cheerRes.status, 200);
  const cheerData = await cheerRes.json();
  assert.equal(cheerData.ok, true);
  assert.equal(cheerData.cheersCount, 1);

  // 4. GET /class-feed
  const feedRes = await api(new Request(origin + '/api/online/class-feed', {
    method: 'GET',
    headers: studentHeaders,
  }));
  assert.equal(feedRes.status, 200);
  const feedData = await feedRes.json();
  assert.equal(feedData.enabled, true);
  assert.ok(feedData.events.length >= 1);
  assert.equal(verifyPrivacyCompliance(feedData.events[0]), true);
});
