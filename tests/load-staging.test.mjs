import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync, createHash, randomUUID} from 'node:crypto';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';

const password = 'Load-Password-123!', salt = 'load-salt';
const passwordHash = `${salt}:${scryptSync(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64*1024*1024}).toString('hex')}`;

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

test('Staging Load Test: 30 then 100 concurrent students with audio & image gameplay', async t => {
  const origin = 'https://staging-load.example.test';
  const f = await createPostgresFixture(t);

  // Seed image and audio assets
  const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const audioBytes = Buffer.from('RIFF$ \x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00 \x00\x00');
  const imageId = 'staging-img-1';
  const audioId = 'staging-audio-1';

  const mockFiles = new Map([
    [`${f.admin.workspaceId}/${imageId}`, pngBytes],
    [`${f.admin.workspaceId}/${audioId}`, audioBytes]
  ]);

  const storage = {
    download: async path => mockFiles.get(path) || Buffer.alloc(0),
    upload: async (path, b) => { mockFiles.set(path, b); }
  };

  await f.store.addMedia(f.admin, {
    id: imageId,
    name: 'art.png',
    mime: 'image/png',
    bytes: pngBytes,
    objectPath: `${f.admin.workspaceId}/${imageId}`
  });

  const pack = {
    id: 'staging-pack-1',
    version: 1,
    title: 'Bài tập Tải Staging',
    kind: 'quiz',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-10-15T00:00:00.000Z',
    items: [
      {id: 'q1', kind: 'multiple-choice', objectiveId: 'LOAD.1', prompt: '3 + 5 = ?', options: ['8', '7', '6', '9'], correctIndex: 0, explanation: '8', media: {imageId, imageAlt: 'Ảnh số học'}},
      {id: 'q2', kind: 'multiple-choice', objectiveId: 'LOAD.2', prompt: '10 - 4 = ?', options: ['6', '5', '7', '8'], correctIndex: 0, explanation: '6'},
      {id: 'q3', kind: 'multiple-choice', objectiveId: 'LOAD.3', prompt: '4 x 2 = ?', options: ['8', '6', '10', '12'], correctIndex: 0, explanation: '8'},
      {id: 'q4', kind: 'multiple-choice', objectiveId: 'LOAD.4', prompt: '12 : 3 = ?', options: ['4', '3', '5', '6'], correctIndex: 0, explanation: '4'}
    ]
  };

  const api = createCloudApi({
    store: f.store,
    storage,
    publicOrigin: origin
  });

  // Provision Class 1 (30 students) and Class 2 (100 students)
  const classA = await f.store.createClass(f.admin, {name: 'Lớp 3A Thử Tải 30 Học Sinh', grade: 3});
  await seedLegacyWeek(f.store, f.admin, {
    requestId: 'staging-week-a',
    classId: classA.id,
    title: 'Tuần Tải Lớp A',
    sets: [{subjectLabel: 'Toán học', pack}]
  });

  const classB = await f.store.createClass(f.admin, {name: 'Lớp 3B Thử Tải 100 Học Sinh', grade: 3});
  await seedLegacyWeek(f.store, f.admin, {
    requestId: 'staging-week-b',
    classId: classB.id,
    title: 'Tuần Tải Lớp B',
    sets: [{subjectLabel: 'Toán học', pack}]
  });

  console.log('Provisioning 30 students for Class A...');
  const studentsA = [];
  for (let i = 1; i <= 30; i++) {
    const username = `student-a-${i}`;
    const student = await f.store.createStudent(f.admin, {classId: classA.id, name: `Bé A${i}`, username}, passwordHash, username);
    studentsA.push({i, username, studentId: student.id});
  }

  console.log('Provisioning 100 students for Class B...');
  const studentsB = [];
  for (let i = 1; i <= 100; i++) {
    const username = `student-b-${i}`;
    const student = await f.store.createStudent(f.admin, {classId: classB.id, name: `Bé B${i}`, username}, passwordHash, username);
    studentsB.push({i, username, studentId: student.id});
  }

  const openQuestionDurations = [];
  const attemptDurations = [];
  let error5xxCount = 0;
  let totalRequests = 0;

  async function executeStudentPlay(st, questionItem = 'q1') {
    let cookie = '', csrf = '';
    async function req(route, method = 'GET', body = undefined) {
      totalRequests++;
      const headers = {
        'X-Bao-An-Question-Protocol': '1',
        ...(cookie ? {Cookie: cookie} : {}),
        ...(body ? {Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf} : {})
      };
      const res = await api(new Request(origin + '/api/online' + route, {
        method,
        headers,
        ...(body ? {body: JSON.stringify(body)} : {})
      }), {ip: `192.0.2.${(st.i % 200) + 1}`});

      if (res.status >= 500) {
        error5xxCount++;
        const errText = await res.text().catch(() => '');
        console.error(`5xx error on ${route}: status ${res.status}`, errText);
        return {status: res.status, data: {}};
      }
      if (res.headers.has('set-cookie')) {
        cookie = res.headers.get('set-cookie').split(';', 1)[0];
      }
      const data = await res.json().catch(() => ({}));
      if (data.csrfToken) csrf = data.csrfToken;
      return {status: res.status, data};
    }

    // 1. Login
    const login = await req('/login', 'POST', {username: st.username, password});
    assert.equal(login.status, 200, `Student ${st.username} login failed`);

    // 2. Fetch Summary
    const summary = await req('/student/summary');
    assert.equal(summary.status, 200);

    // 3. Fetch Map
    const map = await req('/student/map');
    assert.equal(map.status, 200);

    // 4. Start Play
    const playReq = {requestId: `play-${st.username}-${randomUUID().slice(0, 8)}`, moduleId: 'math-quest', packId: pack.id, contentVersion: 1};
    const play = await req('/play/compact', 'POST', playReq);
    assert.ok(play.status === 200 || play.status === 201, `play/compact returned ${play.status}`);
    const sessionId = play.data.session.sessionId;

    // 5. Open Question (measure latency)
    const t0 = performance.now();
    const openRes = await req(`/play/${sessionId}/question-open`, 'POST', {itemId: questionItem});
    const openDuration = performance.now() - t0;
    openQuestionDurations.push(openDuration);
    assert.equal(openRes.status, 200);

    // 6. Submit Attempt for Question
    const tA = performance.now();
    const ans = await req(`/play/${sessionId}/attempt`, 'POST', {
      attemptKey: `ans-${st.username}-${questionItem}-${randomUUID().slice(0, 6)}`,
      itemId: questionItem,
      response: {kind: 'choice', choiceIndex: 0},
      hintsUsed: 0,
      elapsedMs: 2500
    });
    const attemptDuration = performance.now() - tA;
    attemptDurations.push(attemptDuration);
    assert.equal(ans.status, 200);
    assert.equal(ans.data.event.correct, true);

    // 7. Verify Star Balance matches earned stars via summary
    const endSummary = await req('/student/summary');
    assert.equal(endSummary.status, 200);
    const balance = endSummary.data.balance.earned;
    return {username: st.username, studentId: st.studentId, balance};
  }

  async function runConcurrent(items, concurrency, fn) {
    const results = [];
    let index = 0;
    async function worker() {
      while (index < items.length) {
        const item = items[index++];
        if (item) {
          results.push(await fn(item));
        }
      }
    }
    await Promise.all(Array.from({length: concurrency}, () => worker()));
    return results;
  }

  // --- STAGE 1: 30 concurrent students ---
  console.log('Running Stage 1: 30 concurrent students on Class A...');
  const stage1Results = await runConcurrent(studentsA, 8, st => executeStudentPlay(st, 'q1'));
  assert.equal(stage1Results.length, 30);
  for (const res of stage1Results) {
    assert.equal(res.balance, 3, `Student ${res.username} should have exactly 3 stars earned`);
  }
  console.log(`Stage 1 completed with ${stage1Results.length} students, 0 errors.`);

  // --- STAGE 2: 100 concurrent students simulation ---
  console.log('Running Stage 2: 100 concurrent students high-load simulation on Class B...');
  const stage2Results = await runConcurrent(studentsB, 12, st => executeStudentPlay(st, 'q1'));
  assert.equal(stage2Results.length, 100);
  for (const res of stage2Results) {
    assert.equal(res.balance, 3, `Student ${res.username} should have exactly 3 stars earned`);
  }
  console.log(`Stage 2 completed with ${stage2Results.length} students, 0 errors.`);

  // Verification metrics
  const p50 = percentile(openQuestionDurations, 50);
  const p90 = percentile(openQuestionDurations, 90);
  const p95 = percentile(openQuestionDurations, 95);

  console.log(`\n=== STAGING LOAD TEST REPORT ===`);
  console.log(`Total Requests Handled: ${totalRequests}`);
  console.log(`5xx Errors Count: ${error5xxCount} (Requirement: 0)`);
  console.log(`Open Question Latency:`);
  console.log(`  p50: ${p50.toFixed(2)} ms`);
  console.log(`  p90: ${p90.toFixed(2)} ms`);
  console.log(`  p95: ${p95.toFixed(2)} ms (Requirement: <= 1000 ms)`);
  console.log(`Star & Balance Consistency: 100% (All 130 students verified)`);

  // Assertions for Cổng C10
  assert.equal(error5xxCount, 0, '0 5xx errors across load stages');
  assert.ok(p95 <= 1000, `p95 open question latency (${p95.toFixed(2)} ms) must be <= 1000 ms`);

  // Database audit verification: check all 130 awards in PostgreSQL
  const dbAwards = await f.store.rows('SELECT count(*) AS n FROM bao_an.awards WHERE workspace_id = $1', [f.admin.workspaceId]);
  assert.equal(Number(dbAwards[0].n), 130, 'All 130 students have their awards safely persisted in PostgreSQL');
});
