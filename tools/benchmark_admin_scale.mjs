import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { OnlineStore } from '../server/online-store.mjs';
import { adminSummary } from '../server/admin-data.mjs';

const store = new OnlineStore(':memory:');
const db = store.db;
const w = 'scale-workspace';
const at = '2026-11-06T00:00:00.000Z';

try {
  db.exec('BEGIN');
  db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(w, 'Audit scale fixture', at);
  db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run('scale-admin', w, 'scale.admin', 'fixture-only', at);
  const cls = db.prepare('INSERT INTO classes(id,workspace_id,name,grade,created_at) VALUES(?,?,?,?,?)');
  for (let c = 0; c < 23; c++) cls.run('c' + c, w, 'Lớp ' + c, 3, at);
  const user = db.prepare("INSERT INTO users(id,workspace_id,username,password_hash,role,student_id,created_at) VALUES(?,?,?,?,'student',?,?)");
  const student = db.prepare('INSERT INTO students(id,workspace_id,class_id,name,user_id,created_at) VALUES(?,?,?,?,?,?)');
  const award = db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)');
  for (let i = 0; i < 1000; i++) {
    user.run('u' + i, w, 'scale.student.' + i, 'fixture-only', 's' + i, at);
    student.run('s' + i, w, 'c' + (i % 23), 'Học sinh ' + i, 'u' + i, at);
    for (let p = 0; p < 32; p++) award.run(w, 's' + i, 'p' + p, 3, JSON.stringify({ packId: 'p' + p, starTier: 3 }));
  }
  const pack = db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)');
  for (let p = 0; p < 32; p++) {
    pack.run(w, 'p' + p, 1, 'Môn ' + (p % 4), JSON.stringify({ id: 'p' + p, version: 1, title: 'Bộ ' + p, kind: 'quiz', subject: 'math', grade: 3, items: Array.from({ length: 12 }, (_, i) => ({ id: 'q' + i })) }), 'fixture-hash');
  }
  const week = db.prepare('INSERT INTO weeks VALUES(?,?,?,?,?,?,?,?)');
  const sets = db.prepare('INSERT INTO week_sets VALUES(?,?,?,?,?)');
  for (let c = 0; c < 23; c++) {
    for (let i = 0; i < 8; i++) {
      const id = 'c' + c + 'w' + i;
      week.run(id, w, 'c' + c, 'Tuần ' + i, i, id, 'fixture-hash', at);
      for (let s = 0; s < 4; s++) sets.run(w, id, s, 'p' + (i * 4 + s), 1);
    }
  }
  db.exec('COMMIT');

  const originalPrepare = db.prepare.bind(db);
  let queries = 0;
  db.prepare = (sql) => {
    queries++;
    return originalPrepare(sql);
  };

  const admin = { id: 'scale-admin', workspaceId: w, role: 'admin', username: 'scale.admin' };
  const results = [];
  for (const section of ['students', 'weeks', 'wallet']) {
    for (let run = 1; run <= 3; run++) {
      queries = 0;
      const started = performance.now();
      const data = await adminSummary(store, admin, { classId: 'c0', section, offset: 0 });
      results.push({
        section,
        run,
        elapsedMs: Number((performance.now() - started).toFixed(3)),
        queries,
        responseBytes: Buffer.byteLength(JSON.stringify(data)),
        visibleStudents: data.students.length,
        visibleWeeks: data.weeks.length,
        stats: data.stats
      });
    }
  }

  const evidence = {
    kind: 'Local SQLite in-memory data-access benchmark, not Supabase/network/browser speed',
    dataset: { classes: 23, students: 1000, packs: 32, questions: 384, weeks: 184, awards: 32000 },
    environment: { node: process.version, platform: process.platform },
    results
  };

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  store.close();
}
