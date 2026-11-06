import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {rmSync} from 'node:fs';
import {OnlineStore} from '../server/online-store.mjs';

test('SQLite migration upgrades legacy users table with role IN (admin, student) to allow parent role preserving existing rows', t => {
  const dbPath = join(tmpdir(), `baoan-legacy-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  t.after(() => {
    try { rmSync(dbPath, {force: true}); } catch {}
  });

  // 1. Create a raw SQLite database with legacy schema
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
      student_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    );
    INSERT INTO workspaces(id, name, created_at) VALUES('ws-legacy', 'Legacy School', '2026-10-01T00:00:00Z');
    INSERT INTO users(id, workspace_id, username, password_hash, role, created_at)
    VALUES('admin-1', 'ws-legacy', 'admin_legacy', 'hash_admin', 'admin', '2026-10-01T00:00:00Z');
    INSERT INTO users(id, workspace_id, username, password_hash, role, created_at)
    VALUES('student-1', 'ws-legacy', 'student_legacy', 'hash_student', 'student', '2026-10-01T00:00:00Z');
  `);

  // Verify that inserting 'parent' role fails on legacy schema
  assert.throws(() => {
    db.prepare("INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES('p-fail', 'ws-legacy', 'p_fail', 'hash', 'parent', '2026-10-01T00:00:00Z')").run();
  }, /CHECK constraint failed/);
  db.close();

  // 2. Initialize OnlineStore wrapping this database (it should execute schema migrations including users upgrade)
  const store = new OnlineStore(dbPath);

  // 3. Verify existing rows are preserved
  const admin = store.db.prepare("SELECT * FROM users WHERE id='admin-1'").get();
  assert.equal(admin.username, 'admin_legacy');
  assert.equal(admin.role, 'admin');

  const student = store.db.prepare("SELECT * FROM users WHERE id='student-1'").get();
  assert.equal(student.username, 'student_legacy');
  assert.equal(student.role, 'student');

  // 4. Verify 'parent' role can now be inserted cleanly
  assert.doesNotThrow(() => {
    store.db.prepare("INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES('p-success', 'ws-legacy', 'p_success', 'hash', 'parent', '2026-10-01T00:00:00Z')").run();
  });

  const parent = store.db.prepare("SELECT * FROM users WHERE id='p-success'").get();
  assert.equal(parent.username, 'p_success');
  assert.equal(parent.role, 'parent');
  store.close();
});

test('R219 & R220: SQLite migration recovers after interrupted DROP or CREATE without losing accounts', t => {
  for (const point of ['after-create', 'after-insert', 'after-drop', 'repeat-run']) {
    const dbPath = join(tmpdir(), `baoan-recovery-${point}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    try {
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
          student_id TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
        );
        INSERT INTO workspaces(id, name, created_at) VALUES('ws-recovery', 'Recovery School', '2026-10-01T00:00:00Z');
        INSERT INTO users(id, workspace_id, username, password_hash, role, created_at)
        VALUES('admin-rec', 'ws-recovery', 'admin_rec', 'hash_admin', 'admin', '2026-10-01T00:00:00Z');
      `);

      if (point === 'after-create') {
        db.exec("CREATE TABLE users_upgrade_v4(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','student','parent')), student_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);");
      } else if (point === 'after-insert') {
        db.exec("CREATE TABLE users_upgrade_v4(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','student','parent')), student_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL); INSERT INTO users_upgrade_v4 SELECT * FROM users;");
      } else if (point === 'after-drop') {
        db.exec("CREATE TABLE users_upgrade_v4(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','student','parent')), student_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL); INSERT INTO users_upgrade_v4 SELECT * FROM users; DROP TABLE users;");
      }

      db.close();

      // Open OnlineStore: recovery must ensure admin exists in users table and store is configured
      const store1 = new OnlineStore(dbPath);
      assert.equal(store1.configured(), true, `${point}: Store must be configured with admin`);
      const adminRow = store1.db.prepare("SELECT * FROM users WHERE id='admin-rec'").get();
      assert.equal(adminRow.username, 'admin_rec', `${point}: Admin account preserved`);

      // R220: Opening a second time (or repeat-run) must be completely idempotent
      store1.close();
      const store2 = new OnlineStore(dbPath);
      assert.equal(store2.configured(), true, `${point}: Second open remains configured`);
      const adminRow2 = store2.db.prepare("SELECT * FROM users WHERE id='admin-rec'").get();
      assert.equal(adminRow2.username, 'admin_rec', `${point}: Admin account preserved on re-open`);
      store2.close();
    } finally {
      try { rmSync(dbPath, {force: true}); } catch {}
    }
  }
});
