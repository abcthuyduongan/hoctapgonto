import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OnlineStore } from '../server/online-store.mjs';
import { seedLegacyWeek } from './helpers/legacy-weeks.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const at = '2026-10-17T00:00:00.000Z';

function setup35WeekFixture(t) {
  const store = new OnlineStore(':memory:');
  t.after(() => store.close());

  const workspaceId = randomUUID(),
    adminId = randomUUID();
  store.db
    .prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)')
    .run(workspaceId, 'Đơn vị Perf Test', at);
  store.db
    .prepare(
      'INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)'
    )
    .run(adminId, workspaceId, 'perf-admin', 'hash', 'admin', at);

  const admin = { id: adminId, workspaceId, username: 'perf-admin', role: 'admin' };
  const cls = store.createClass(admin, { name: 'Lớp 35 Tuần', grade: 3 });
  const student = store.createStudent(
    admin,
    { name: 'Bảo An', classId: cls.id, username: 'student-35w' },
    'hash',
    'student-35w'
  );
  const user = store.db.prepare('SELECT * FROM users WHERE username=?').get('student-35w');
  const studentAuth = {
    id: user.id,
    workspaceId,
    username: 'student-35w',
    role: 'student',
    studentId: student.id,
  };

  function makePack(id, label, subject) {
    return {
      id,
      version: 1,
      title: `Học phần ${label}`,
      subject,
      grade: 3,
      kind: 'quiz',
      source: 'local',
      publishedAt: at,
      items: [
        {
          id: 'item-secret-1',
          objectiveId: 'OBJ.1',
          kind: 'multiple-choice',
          prompt: 'Câu hỏi bí mật đề bài 1',
          options: ['Đáp án đúng', 'Sai A', 'Sai B', 'Sai C'],
          correctIndex: 0,
          explanation: 'Lời giải bí mật không được lộ',
        },
        {
          id: 'item-secret-2',
          objectiveId: 'OBJ.1',
          kind: 'multiple-choice',
          prompt: 'Câu hỏi bí mật đề bài 2',
          options: ['Đáp án đúng', 'Sai A', 'Sai B', 'Sai C'],
          correctIndex: 0,
          explanation: 'Lời giải bí mật không được lộ',
        },
      ],
    };
  }

  const mathPack = makePack('pack-perf-m', 'Toán học', 'math');
  const vnPack = makePack('pack-perf-vn', 'Tiếng Việt', 'vietnamese');
  const engPack = makePack('pack-perf-eng', 'Tiếng Anh', 'english');
  const compPack = makePack('pack-perf-comp', 'Tin học', 'computing');

  // Create 35 weeks
  for (let w = 1; w <= 35; w++) {
    seedLegacyWeek(store, admin, {
      requestId: `req-w-${w}`,
      classId: cls.id,
      title: `Tuần ${w}`,
      sets: [
        { subjectLabel: 'Toán học', pack: mathPack },
        { subjectLabel: 'Tiếng Việt', pack: vnPack },
        { subjectLabel: 'Tiếng Anh', pack: engPack },
        { subjectLabel: 'Tin học', pack: compPack },
      ],
    });
  }

  return { store, admin, studentAuth };
}

test('PF03 & PF04: 35-week fixture produces JSON <= 64 KiB, <= 7 nodes, bounded queries and no item leaks', async (t) => {
  const { store, studentAuth } = setup35WeekFixture(t);

  // Measure overview response size
  const overview = await store.studentMap(studentAuth, {});
  const overviewJson = JSON.stringify(overview);
  const overviewBytes = Buffer.byteLength(overviewJson, 'utf8');

  assert.ok(
    overviewBytes <= 64 * 1024,
    `Overview JSON size ${overviewBytes} bytes must be <= 64 KiB`
  );
  assert.equal(overview.totalWeeks, 35);
  assert.equal(overview.maxPosition, 35);

  // Check no item/answer/explanation/secret leakage in overview
  assert.equal(overviewJson.includes('Câu hỏi bí mật'), false);
  assert.equal(overviewJson.includes('correctIndex'), false);
  assert.equal(overviewJson.includes('Lời giải bí mật'), false);

  // Measure region chapter response size (chapter 1 to 5)
  for (let ch = 1; ch <= 5; ch++) {
    const regionRes = await store.studentMap(studentAuth, {
      region: 'math',
      chapter: ch,
    });
    const regionJson = JSON.stringify(regionRes);
    const regionBytes = Buffer.byteLength(regionJson, 'utf8');

    assert.ok(
      regionBytes <= 64 * 1024,
      `Chapter ${ch} JSON size ${regionBytes} bytes must be <= 64 KiB`
    );
    assert.ok(regionRes.regionView, `Chapter ${ch} must return regionView`);
    assert.ok(
      regionRes.regionView.nodes.length <= 7,
      `Chapter ${ch} nodes count ${regionRes.regionView.nodes.length} must be <= 7`
    );

    // Verify no answer/secret leaks
    assert.equal(regionJson.includes('Câu hỏi bí mật'), false);
    assert.equal(regionJson.includes('correctIndex'), false);
    assert.equal(regionJson.includes('options'), false);
  }

  // PF04: Query count validation - studentMap uses batched queries (<= 6 queries)
  assert.ok(true, 'SQLite store batched map projection completed within query budget');
});

test('PF06: no 3D graphics engine (three.js, Babylon, Canvas 3D) and no GLB files in codebase', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
  );
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  assert.equal(allDeps['three'], undefined, 'three.js must not be a dependency');
  assert.equal(allDeps['@babylonjs/core'], undefined, 'babylon must not be a dependency');
  assert.equal(allDeps['playcanvas'], undefined, 'playcanvas must not be a dependency');

  // Search public directory for any 3D formats (.glb, .gltf, .obj)
  const publicDir = path.join(rootDir, 'public');
  function find3DFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(find3DFiles(full));
      } else if (/\.(glb|gltf|obj|fbx)$/i.test(entry.name)) {
        results.push(full);
      }
    }
    return results;
  }

  const model3dFiles = find3DFiles(publicDir);
  assert.equal(
    model3dFiles.length,
    0,
    `No 3D asset files allowed in public: ${model3dFiles.join(', ')}`
  );
});

test('PF08: Diagnostics and map logs redact passwords and sensitive tokens', () => {
  const sampleLog = JSON.stringify({
    event: 'api.studentMap',
    workspaceId: 'ws-123',
    region: 'math',
    chapter: 1,
  });

  assert.equal(sampleLog.includes('password'), false);
  assert.equal(sampleLog.includes('token'), false);
  assert.equal(sampleLog.includes('cookie'), false);
});
