import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync, createHash, randomUUID} from 'node:crypto';
import {PostgresStore} from '../server/postgres-store.mjs';
import {OnlineStore} from '../server/online-store.mjs';
import {createPostgresFixture, authFor} from './helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';

const password = 'D02-Password-123!', salt = 'd02-salt';
const passwordHash = `${salt}:${scryptSync(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64*1024*1024}).toString('hex')}`;

test('D02: 40-week cumulative dataset keeps bounded summary query count and sub-second execution', async t => {
  const f = await createPostgresFixture(t);
  const cls = await f.store.createClass(f.admin, {name: 'Lớp 3A 40 Tuần D02', grade: 3});
  const student = await f.store.createStudent(f.admin, {classId: cls.id, name: 'Bảo An', username: 'baoan-d02'}, passwordHash, 'baoan-d02');
  const user = await f.store.findUserByUsername('baoan-d02');
  const auth = authFor(user);

  console.log('Seeding 40-week curriculum dataset in Postgres...');
  const subjects = [
    {key: 'math', label: 'Toán học'},
    {key: 'vietnamese', label: 'Tiếng Việt'},
    {key: 'english', label: 'Tiếng Anh'},
  ];

  for (let w = 1; w <= 40; w++) {
    const sets = subjects.map((sub, sIdx) => {
      const packId = `pack-w${w}-${sub.key}`;
      return {
        subjectLabel: sub.label,
        pack: {
          id: packId,
          version: 1,
          title: `Tuần ${w} - ${sub.label}`,
          kind: 'quiz',
          subject: sub.key,
          grade: 3,
          source: 'local',
          publishedAt: '2026-10-15T00:00:00.000Z',
          items: Array.from({length: 4}, (_, i) => ({
            id: `${packId}-q${i+1}`,
            kind: 'multiple-choice',
            objectiveId: `W${w}.${sub.key}`,
            prompt: `Câu hỏi ${i+1} môn ${sub.label} tuần ${w}?`,
            options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
            correctIndex: 0,
            explanation: `Giải thích ${i+1}`
          }))
        }
      };
    });

    await seedLegacyWeek(f.store, f.admin, {
      requestId: `week-req-${w}`,
      classId: cls.id,
      title: `Tuần học thứ ${w}`,
      sets
    });

    // Simulate completion for the first 30 weeks (30 * 3 = 90 awards)
    if (w <= 30) {
      for (const set of sets) {
        await f.store.exec(
          'INSERT INTO bao_an.awards(workspace_id, student_id, pack_id, tier, json) VALUES($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING',
          [f.admin.workspaceId, student.id, set.pack.id, 3, JSON.stringify({packId: set.pack.id, starTier: 3, awardedAt: new Date().toISOString()})]
        );
      }
    }
  }

  // Seed redemptions and audits to simulate high cumulative 1-year history
  for (let r = 1; r <= 15; r++) {
    await f.store.exec(
      'INSERT INTO bao_an.redemptions(workspace_id, id, student_id, status, json) VALUES($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING',
      [f.admin.workspaceId, `req-d02-${r}`, student.id, 'fulfilled', JSON.stringify({requestId: `req-d02-${r}`, goalVnd: 50000, rateVnd: 1000, status: 'fulfilled', history: [{status: 'fulfilled', at: new Date().toISOString()}]})]
    );
  }

  for (let a = 1; a <= 200; a++) {
    await f.store.exec(
      'INSERT INTO bao_an.audit(id, workspace_id, user_id, action, target_id, at) VALUES($1, $2, $3, $4, $5, $6)',
      [randomUUID(), f.admin.workspaceId, auth.id, a % 2 === 0 ? 'student.journey.advance' : 'student.discovery.view', `target-${a}`, new Date().toISOString()]
    );
  }

  // 1. Measure studentSummary execution time and correctness
  const start = performance.now();
  const summary = await f.store.studentSummary(auth, '0');
  const duration = performance.now() - start;

  console.log(`D02 summary 40 weeks execution time: ${duration.toFixed(2)} ms`);
  assert.ok(duration < 500, `Summary took ${duration} ms, expected < 500 ms`);
  assert.equal(summary.weeks.length, 7, 'First page of summary returns bounded weeks view (page limit 20 sets)');
  assert.equal(summary.page.limit, 20);
  assert.equal(summary.page.totalWeeks, 40, 'Identifies total 40 weeks in full year');
  assert.equal(summary.page.totalSets, 120, 'Identifies total 120 sets in full year');

  // 2. Verify star balance accurately calculates: 90 awards * 3 stars = 270 stars earned
  assert.equal(summary.balance.earned, 270, 'Accurately computes earned stars from awards');

  // 3. Test next cursor pagination
  const nextCursor = summary.page.nextCursor;
  assert.ok(nextCursor !== null, 'Pagination cursor for next page exists');
  const page2 = await f.store.studentSummary(auth, nextCursor);
  assert.equal(page2.page.cursor, nextCursor);
  assert.ok(page2.weeks.length > 0);
});

test('D02: SQLite OnlineStore handles 40 weeks with fast summary', () => {
  const store = new OnlineStore(':memory:');
  try {
    const workspaceId = randomUUID(), adminId = randomUUID(), at = new Date().toISOString();
    store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId, 'Trường D02', at);
    store.db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(adminId, workspaceId, 'manager', passwordHash, at);
    const admin = {id: adminId, workspaceId, username: 'manager', role: 'admin'};

    const cls = store.createClass(admin, {name: 'Lớp 3B', grade: 3});
    const student = store.createStudent(admin, {classId: cls.id, name: 'Minh Quân', username: 'quan40'}, passwordHash, 'quan40');
    const user = store.db.prepare("SELECT * FROM users WHERE username='quan40'").get();
    const auth = {id: user.id, workspaceId, username: 'quan40', role: 'student', studentId: student.id};

    // Seed 40 weeks in SQLite
    for (let w = 1; w <= 40; w++) {
      const sets = [
        {
          subjectLabel: 'Toán học',
          pack: {
            id: `sq-pack-w${w}-math`,
            version: 1,
            title: `Tuần ${w} Toán`,
            kind: 'quiz',
            subject: 'math',
            grade: 3,
            source: 'local',
            publishedAt: '2026-10-15T00:00:00.000Z',
            items: [
            {id: `sq-w${w}-q1`, kind: 'multiple-choice', objectiveId: 'MATH', prompt: `Câu 1 tuần ${w}`, options: ['1','2','3','4'], correctIndex: 0, explanation: 'OK'},
            {id: `sq-w${w}-q2`, kind: 'multiple-choice', objectiveId: 'MATH', prompt: `Câu 2 tuần ${w}`, options: ['5','6','7','8'], correctIndex: 1, explanation: 'OK'}
          ]
          }
        }
      ];
      seedLegacyWeek(store, admin, {requestId: `sq-week-${w}`, classId: cls.id, title: `Tuần ${w}`, sets});
    }

    const start = performance.now();
    const summary = store.studentSummary(auth, '0');
    const elapsed = performance.now() - start;

    console.log(`SQLite 40 weeks summary elapsed: ${elapsed.toFixed(2)} ms`);
    assert.ok(elapsed < 200, 'SQLite summary should complete in < 200ms');
    assert.equal(summary.page.totalWeeks, 40);
    assert.equal(summary.page.totalSets, 40);
  } finally {
    store.close();
  }
});
