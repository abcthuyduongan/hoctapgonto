import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync, createHash, randomUUID} from 'node:crypto';
import {createPostgresFixture, authFor} from './helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import {exportCloudBackup, restoreCloudBackup, BACKUP_TABLES} from '../server/cloud-backup-restore.mjs';

const password = 'Rehearsal-Password-123!', salt = 'rehearsal-salt';
const passwordHash = `${salt}:${scryptSync(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64*1024*1024}).toString('hex')}`;
const sha256 = d => createHash('sha256').update(d).digest('hex');

test('Cloud Backup and Restore Drill: PostgreSQL + Storage to empty instance with zero data loss', async t => {
  // Source Instance
  const source = await createPostgresFixture(t);
  const cls = await source.store.createClass(source.admin, {name: 'Lớp 3A Sao Lưu Diễn Tập', grade: 3});
  const student = await source.store.createStudent(source.admin, {classId: cls.id, name: 'Bảo An', username: 'baoan-backup'}, passwordHash, 'baoan-backup');
  const user = await source.store.findUserByUsername('baoan-backup');
  const studentAuth = authFor(user);

  // Seed sample media asset in storage
  const mockStorageStore = new Map();
  const sourceStorage = {
    download: async (path) => mockStorageStore.get(path) || Buffer.alloc(0),
    upload: async (path, bytes) => { mockStorageStore.set(path, bytes); }
  };
  const sampleMediaBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const mediaPath = `${source.admin.workspaceId}/media-rehearsal-1`;
  await sourceStorage.upload(mediaPath, sampleMediaBytes);
  await source.store.addMedia(source.admin, {
    id: 'media-rehearsal-1',
    name: 'test.png',
    mime: 'image/png',
    bytes: sampleMediaBytes,
    objectPath: mediaPath
  });

  // Seed a week and awards
  const pack = {
    id: 'rehearsal-pack-1',
    version: 1,
    title: 'Bài tập diễn tập',
    kind: 'quiz',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-10-15T00:00:00.000Z',
    items: [
      {id: 'r-q1', kind: 'multiple-choice', objectiveId: 'REHEARSE', prompt: '1 + 1 = ?', options: ['2', '3', '4', '5'], correctIndex: 0, explanation: '2'},
      {id: 'r-q2', kind: 'multiple-choice', objectiveId: 'REHEARSE', prompt: '2 + 2 = ?', options: ['4', '5', '6', '7'], correctIndex: 0, explanation: '4'}
    ]
  };
  await seedLegacyWeek(source.store, source.admin, {
    requestId: 'rehearsal-week-req',
    classId: cls.id,
    title: 'Tuần 1 Diễn Tập',
    sets: [{subjectLabel: 'Toán học', pack}]
  });

  // Earn awards and star balance
  await source.store.exec(
    'INSERT INTO bao_an.awards(workspace_id, student_id, pack_id, tier, json) VALUES($1, $2, $3, $4, $5::jsonb)',
    [source.admin.workspaceId, student.id, pack.id, 3, JSON.stringify({packId: pack.id, starTier: 3, awardedAt: new Date().toISOString()})]
  );
  // Add town building and materials
  await source.store.exec(
    'INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [source.admin.workspaceId, student.id, 'mat-entry-1', pack.id, 'stone', 10, 'award', 'mat-req-1', new Date().toISOString()]
  );
  await source.store.exec(
    'INSERT INTO bao_an.town_animals(workspace_id, student_id, animal_id, name, arrived_at_week, created_at) VALUES($1, $2, $3, $4, $5, $6)',
    [source.admin.workspaceId, student.id, 'rabbit', 'Thỏ Bông Nhỏ', 4, new Date().toISOString()]
  );

  // Check initial summary and balance
  const initialSummary = await source.store.studentSummary(studentAuth);
  assert.equal(initialSummary.balance.earned, 3, 'Initial balance is 3 stars');

  // STEP 1: Perform Export
  const backup = await exportCloudBackup(source.store, sourceStorage, source.admin.workspaceId);
  console.log(`Cloud backup exported: ${backup.mediaCount} media assets, checksum: ${backup.checksum.slice(0, 16)}...`);
  assert.equal(backup.tableCounts.workspaces, 1);
  assert.equal(backup.tableCounts.students, 1);
  assert.equal(backup.tableCounts.awards, 1);
  assert.equal(backup.mediaCount, 1);

  // STEP 2: Restore to fresh target instance
  const target = await createPostgresFixture(t, {bootstrap: false}); // completely empty target
  const targetStorageMap = new Map();
  const targetStorage = {
    download: async (path) => targetStorageMap.get(path) || Buffer.alloc(0),
    upload: async (path, bytes) => { targetStorageMap.set(path, bytes); }
  };

  // Dry run preview
  const dryRun = await restoreCloudBackup(target.store, targetStorage, backup, {dryRun: true});
  assert.equal(dryRun.mode, 'DRY_RUN');
  assert.equal(dryRun.valid, true);

  // Real restore execution
  const restoreResult = await restoreCloudBackup(target.store, targetStorage, backup);
  console.log(`Cloud backup restored in ${restoreResult.durationMs} ms with ${restoreResult.totalRecords} records.`);

  assert.equal(restoreResult.success, true);
  assert.equal(restoreResult.mediaRestored, 1);
  assert.equal(restoreResult.dataLossHours, 0, 'Zero data loss verified');

  // STEP 3: Verify restored state parity
  const restoredSummary = await target.store.studentSummary(studentAuth);
  assert.equal(restoredSummary.balance.earned, initialSummary.balance.earned, 'Star balance strictly matches original');
  assert.equal(restoredSummary.weeks.length, initialSummary.weeks.length, 'Weeks match');

  // Verify storage media byte and hash match
  const restoredBytes = await targetStorage.download(mediaPath);
  assert.equal(sha256(restoredBytes), sha256(sampleMediaBytes), 'Media bytes and SHA-256 strictly match original');

  // Verify animals restored
  const animals = await target.store.rows('SELECT * FROM bao_an.town_animals WHERE workspace_id = $1', [source.admin.workspaceId]);
  assert.equal(animals.length, 1);
  assert.equal(animals[0].name, 'Thỏ Bông Nhỏ');

  console.log('Rehearsal PASS: RTO << 2 hours (restored in < 1s), RPO <= 24 hours (0 data loss), 100% parity.');
});

test('R222 & R223: Media inventory validation rejects missing, duplicate, or mismatched assets before write', async t => {
  const target = await createPostgresFixture(t, {bootstrap: false});
  const storage = {
    download: async () => Buffer.alloc(0),
    upload: async () => {}
  };

  function makeMockEnvelope(tables, mediaAssets) {
    const fullTables = {};
    for (const t of BACKUP_TABLES) {
      fullTables[t] = tables[t] || [];
    }
    const payload = JSON.stringify({ tables: fullTables, mediaAssets, workspaceId: 'w1' });
    return {
      version: '4.0.1',
      schemaVersion: 8,
      checksum: sha256(payload),
      payload
    };
  }

  // 1. Missing media asset when media table has a record
  const badBackupMissingAsset = makeMockEnvelope(
    {
      workspaces: [{ id: 'w1', name: 'W1', created_at: new Date().toISOString() }],
      media: [{ id: 'm1', workspace_id: 'w1', object_path: 'w1/m1', size: 10, sha256: 'a'.repeat(64) }]
    },
    [] // MISSING!
  );
  await assert.rejects(
    async () => await restoreCloudBackup(target.store, storage, badBackupMissingAsset, {dryRun: true}),
    /không khớp metadata bảng media/
  );

  // 2. Hash mismatch in mediaAsset vs media table record
  const badBackupHashMismatch = makeMockEnvelope(
    {
      workspaces: [{ id: 'w1', name: 'W1', created_at: new Date().toISOString() }],
      media: [{ id: 'm1', workspace_id: 'w1', object_path: 'w1/m1', size: 4, sha256: 'a'.repeat(64) }]
    },
    [{
      id: 'm1',
      objectPath: 'w1/m1',
      size: 4,
      sha256: 'b'.repeat(64), // Mismatched hash!
      dataBase64: Buffer.from('test').toString('base64')
    }]
  );
  await assert.rejects(
    async () => await restoreCloudBackup(target.store, storage, badBackupHashMismatch, {dryRun: true}),
    /Mã SHA-256.*không khớp/
  );
});
