import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OnlineStore } from '../server/online-store.mjs';
import { PostgresStore } from '../server/postgres-store.mjs';
import { createPostgresFixture, authFor } from './helpers/postgres-fixture.mjs';
import { seedLegacyWeek } from './helpers/legacy-weeks.mjs';

const at = '2026-10-17T00:00:00.000Z';

function sqliteFixture(t) {
  const store = new OnlineStore(':memory:');
  t.after(() => store.close());
  const workspaceId = randomUUID(), adminId = randomUUID();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId, 'Đơn vị Map Test', at);
  store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(adminId, workspaceId, 'manager', 'hash', 'admin', at);
  const admin = { id: adminId, workspaceId, username: 'manager', role: 'admin' };
  const cls = store.createClass(admin, { name: 'Lớp 3A', grade: 3 });
  const student = store.createStudent(admin, { name: 'Em Bé', classId: cls.id, username: 'student-test' }, 'hash', 'student-test');
  const user = store.db.prepare('SELECT * FROM users WHERE username=?').get('student-test');
  const studentAuth = { id: user.id, workspaceId, username: 'student-test', role: 'student', studentId: student.id };

  let reqCount = 0;
  function pack(id = 'pack-math', count = 4, subject = 'math') {
    return {
      id,
      version: 1,
      title: 'Bài tập ' + id,
      subject,
      grade: 3,
      kind: 'quiz',
      source: 'local',
      publishedAt: at,
      items: Array.from({ length: count }, (_, i) => ({
        id: `q${i + 1}`,
        kind: 'multiple-choice',
        objectiveId: 'OBJ.1',
        prompt: `Đề câu ${i + 1}`,
        options: ['Đúng', 'Sai A', 'Sai B', 'Sai C'],
        correctIndex: 0,
        explanation: 'Lời giải chi tiết bí mật.',
      })),
    };
  }

  function publishWeek(title, sets) {
    reqCount++;
    return seedLegacyWeek(store, admin, {
      requestId: 'req-w-' + reqCount,
      classId: cls.id,
      title,
      sets,
    });
  }

  return { store, admin, studentAuth, student, cls, pack, publishWeek };
}

function assertNoSecretsOrPII(obj) {
  const forbiddenKeys = new Set([
    'items',
    'options',
    'correctIndex',
    'answer',
    'acceptedAnswers',
    'passage',
    'transcript',
    'questionIds',
    'password',
    'password_hash',
    'secret',
    'token',
    'csrf',
    'balance',
  ]);

  function check(val) {
    if (!val || typeof val !== 'object') return;
    if (Array.isArray(val)) {
      for (const item of val) check(item);
      return;
    }
    for (const [k, v] of Object.entries(val)) {
      assert.equal(forbiddenKeys.has(k), false, `Forbidden key leaked: ${k}`);
      check(v);
    }
  }

  check(obj);
}

test('API01: Admin calling studentMap is rejected with 403', (t) => {
  const f = sqliteFixture(t);
  assert.throws(
    () => f.store.studentMap(f.admin),
    (err) => err.status === 403
  );
});

test('API02: Foreign parameters (studentId, classId, workspaceId, etc.) in query rejected with 400', (t) => {
  const f = sqliteFixture(t);
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { studentId: 'other-student' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { classId: 'other-class' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { workspaceId: 'other-workspace' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { url: 'https://evil.com' }),
    (err) => err.status === 400
  );
});

test('API03 & API04: No items/PII leak; map reads are completely idempotent and mutate no records', (t) => {
  const f = sqliteFixture(t);
  const mathPack = f.pack('pack-m1', 4, 'math');
  const vnPack = f.pack('pack-v1', 4, 'vietnamese');
  f.publishWeek('Tuần 01', [
    { subjectLabel: 'Toán', pack: mathPack },
    { subjectLabel: 'Tiếng Việt', pack: vnPack },
  ]);

  // Snapshot database row counts before
  const countTable = (tbl) => f.store.db.prepare(`SELECT count(*) as cnt FROM ${tbl}`).get().cnt;
  const playsBefore = countTable('plays');
  const attemptsBefore = countTable('attempts');
  const awardsBefore = countTable('awards');
  const auditBefore = countTable('audit');

  // Call studentMap 10 times with different query combinations
  for (let i = 0; i < 10; i++) {
    const res1 = f.store.studentMap(f.studentAuth);
    assertNoSecretsOrPII(res1);
    assert.equal(res1.schemaVersion, 1);
    assert.equal(res1.totalWeeks, 1);
    assert.equal(res1.maxPosition, 1);

    const res2 = f.store.studentMap(f.studentAuth, { region: 'math' });
    assertNoSecretsOrPII(res2);
    assert.equal(res2.regionView.regionId, 'math');
    assert.equal(res2.regionView.nodes.length, 1);
    assert.equal(res2.regionView.nodes[0].slot, 1);
  }

  // Verify counts didn't change at all
  assert.equal(countTable('plays'), playsBefore);
  assert.equal(countTable('attempts'), attemptsBefore);
  assert.equal(countTable('awards'), awardsBefore);
  assert.equal(countTable('audit'), auditBefore);
});

test('API05 & API06: Query parameter validation & 0-week class edge cases', (t) => {
  const f = sqliteFixture(t);
  // FX00: 0 weeks
  const emptyOverview = f.store.studentMap(f.studentAuth);
  assert.equal(emptyOverview.totalWeeks, 0);
  assert.equal(emptyOverview.maxPosition, 0);
  assert.equal(emptyOverview.regionView, null);

  const emptyMathChapter1 = f.store.studentMap(f.studentAuth, { region: 'math', chapter: '1' });
  assert.equal(emptyMathChapter1.regionView.nodes.length, 0);
  assert.equal(emptyMathChapter1.regionView.chapter, 1);
  assert.equal(emptyMathChapter1.regionView.totalChapters, 0);

  const emptyMathCurrent = f.store.studentMap(f.studentAuth, { region: 'math', chapter: 'current' });
  assert.equal(emptyMathCurrent.regionView.nodes.length, 0);

  // Chapter 2 on 0 weeks -> 400
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { region: 'math', chapter: '2' }),
    (err) => err.status === 400
  );

  // Invalid parameters
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { region: 'invalid-region' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { chapter: '1' }), // chapter without region
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { region: 'math', chapter: '0' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { region: 'math', chapter: '01' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { region: 'math', chapter: '-1' }),
    (err) => err.status === 400
  );
  assert.throws(
    () => f.store.studentMap(f.studentAuth, { region: 'math', chapter: '1.5' }),
    (err) => err.status === 400
  );
});

test('API07: Multi-week and multi-subject nodes mapped to correct slots and regions', (t) => {
  const f = sqliteFixture(t);
  const math1 = f.pack('pack-m1', 2, 'math');
  const vn1 = f.pack('pack-vn1', 2, 'vietnamese');
  const eng1 = f.pack('pack-eng1', 2, 'english');
  const comp1 = f.pack('pack-comp1', 2, 'computing');

  // Week 1 has all 4 subjects
  f.publishWeek('Tuần 01', [
    { subjectLabel: 'Toán', pack: math1 },
    { subjectLabel: 'Tiếng Việt', pack: vn1 },
    { subjectLabel: 'Tiếng Anh', pack: eng1 },
    { subjectLabel: 'Tin học', pack: comp1 },
  ]);

  // Week 2 has only Vietnamese and English
  const vn2 = f.pack('pack-vn2', 2, 'vietnamese');
  const eng2 = f.pack('pack-eng2', 2, 'english');
  f.publishWeek('Tuần 02', [
    { subjectLabel: 'Tiếng Việt', pack: vn2 },
    { subjectLabel: 'Tiếng Anh', pack: eng2 },
  ]);

  // Week 3 has only Math
  const math3 = f.pack('pack-m3', 2, 'math');
  f.publishWeek('Tuần 03', [
    { subjectLabel: 'Toán', pack: math3 },
  ]);

  const mathMap = f.store.studentMap(f.studentAuth, { region: 'math', chapter: '1' });
  assert.equal(mathMap.regionView.nodes.length, 2);
  assert.equal(mathMap.regionView.nodes[0].position, 1);
  assert.equal(mathMap.regionView.nodes[0].slot, 1);
  assert.equal(mathMap.regionView.nodes[1].position, 3);
  assert.equal(mathMap.regionView.nodes[1].slot, 3);

  const vnMap = f.store.studentMap(f.studentAuth, { region: 'vietnamese', chapter: '1' });
  assert.equal(vnMap.regionView.nodes.length, 2);
  assert.equal(vnMap.regionView.nodes[0].slot, 1);
  assert.equal(vnMap.regionView.nodes[1].slot, 2);

  const compMap = f.store.studentMap(f.studentAuth, { region: 'computing', chapter: '1' });
  assert.equal(compMap.regionView.nodes.length, 1);
  assert.equal(compMap.regionView.nodes[0].slot, 1);
});

test('API10: PostgresStore produces identical studentMap projections to SQLite', async (t) => {
  const pgFixture = await createPostgresFixture(t);
  const cls = await pgFixture.store.createClass(pgFixture.admin, { name: 'Lớp PG', grade: 3 });
  const learner = await pgFixture.store.createStudent(pgFixture.admin, { name: 'Học sinh PG', classId: cls.id, username: 'pg-student' }, 'salt:hash', 'pg-student');
  const auth = authFor(await pgFixture.store.findUserByUsername('pg-student'));

  // 0-weeks check
  const emptyPg = await pgFixture.store.studentMap(auth);
  assert.equal(emptyPg.schemaVersion, 1);
  assert.equal(emptyPg.totalWeeks, 0);
  assert.equal(emptyPg.maxPosition, 0);
  assert.equal(emptyPg.regionView, null);
  assertNoSecretsOrPII(emptyPg);

  // Invalid query rejected
  await assert.rejects(
    pgFixture.store.studentMap(auth, { chapter: 'current' }),
    (err) => err.status === 400
  );
  await assert.rejects(
    pgFixture.store.studentMap(auth, { region: 'fake' }),
    (err) => err.status === 400
  );

  // Admin rejected
  await assert.rejects(
    pgFixture.store.studentMap(pgFixture.admin),
    (err) => err.status === 403
  );
});
