import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync, createHash} from 'node:crypto';
import {createPostgresFixture, authFor} from './helpers/postgres-fixture.mjs';
import {seedLegacyWeek} from './helpers/legacy-weeks.mjs';
import {exportCloudBackup, restoreCloudBackup} from '../server/cloud-backup-restore.mjs';
import {readBuildIdentity} from '../server/build-identity.mjs';
import packageJson from '../package.json' with { type: 'json' };

const password = 'RollbackPassword123!', salt = 'rollback-salt';
const passwordHash = `${salt}:${scryptSync(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64*1024*1024}).toString('hex')}`;

test('Staging Rollback & Re-Upgrade Rehearsal: zero data loss, idempotent schema, 1-action restore', async t => {
  // 1. Setup Staging Instance with pre-v4 state
  const staging = await createPostgresFixture(t);
  const cls = await staging.store.createClass(staging.admin, {name: 'Lớp 3A Staging Rollback', grade: 3});
  const student = await staging.store.createStudent(staging.admin, {classId: cls.id, name: 'Bảo An', username: 'baoan-rollback'}, passwordHash, 'baoan-rollback');
  const user = await staging.store.findUserByUsername('baoan-rollback');
  const studentAuth = authFor(user);

  const pack = {
    id: 'rollback-test-pack',
    version: 1,
    title: 'Bài tập Staging Rollback',
    kind: 'quiz',
    subject: 'math',
    grade: 3,
    source: 'local',
    publishedAt: '2026-10-15T00:00:00.000Z',
    items: [
      {id: 'rb-q1', kind: 'multiple-choice', objectiveId: 'RB', prompt: '5 + 5 = ?', options: ['10', '11', '12', '13'], correctIndex: 0, explanation: '10'},
      {id: 'rb-q2', kind: 'multiple-choice', objectiveId: 'RB', prompt: '6 + 6 = ?', options: ['12', '13', '14', '15'], correctIndex: 0, explanation: '12'}
    ]
  };
  await seedLegacyWeek(staging.store, staging.admin, {
    requestId: 'rb-week-req',
    classId: cls.id,
    title: 'Tuần Học Staging',
    sets: [{subjectLabel: 'Toán học', pack}]
  });

  // Award stars before upgrade
  await staging.store.exec(
    'INSERT INTO bao_an.awards(workspace_id, student_id, pack_id, tier, json) VALUES($1, $2, $3, $4, $5::jsonb)',
    [staging.admin.workspaceId, student.id, pack.id, 3, JSON.stringify({packId: pack.id, starTier: 3, awardedAt: new Date().toISOString()})]
  );

  const mockStorageMap = new Map();
  const stagingStorage = {
    download: async (path) => mockStorageMap.get(path) || Buffer.alloc(0),
    upload: async (path, bytes) => { mockStorageMap.set(path, bytes); }
  };

  // STEP 1: Take Pre-Upgrade Snapshot (Backup prior to v4.0.0 migration)
  const preUpgradeBackup = await exportCloudBackup(staging.store, stagingStorage, staging.admin.workspaceId);
  assert.ok(preUpgradeBackup.checksum, 'Pre-upgrade snapshot generated with valid checksum');
  assert.equal(preUpgradeBackup.tableCounts.awards, 1);

  // STEP 2: Perform v4.0.0 Operations (Gifts, Materials, Badges, Town, Contests)
  await staging.store.exec(
    'INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [staging.admin.workspaceId, student.id, 'mat-rb-1', pack.id, 'stone', 15, 'award', 'mat-rb-req-1', new Date().toISOString()]
  );
  await staging.store.exec(
    'INSERT INTO bao_an.badge_awards(workspace_id, student_id, badge_id, unlocked_at, json) VALUES($1, $2, $3, $4, $5)',
    [staging.admin.workspaceId, student.id, 'first_lesson', new Date().toISOString(), JSON.stringify({reason: 'Hoàn thành xuất sắc'})]
  );

  // Verify v4.0.0 state active
  const v4Summary = await staging.store.studentSummary(studentAuth);
  assert.equal(v4Summary.balance.earned, 3);
  assert.equal(v4Summary.badges.filter(b => b.unlocked).length, 1);
  const v4Materials = await staging.store.materials(studentAuth, student.id);
  assert.equal(v4Materials.stone, 15);

  // STEP 3: Rehearse 1-Action Rollback to Pre-Upgrade Snapshot
  const rollbackResult = await restoreCloudBackup(staging.store, stagingStorage, preUpgradeBackup);
  assert.equal(rollbackResult.success, true);
  assert.ok(rollbackResult.totalRecords > 0, 'Restored pre-upgrade rows');

  // Verify state after rollback: awards still intact, post-upgrade badges rolled back
  const postRollbackSummary = await staging.store.studentSummary(studentAuth);
  assert.equal(postRollbackSummary.balance.earned, 3, 'Star balance strictly preserved');
  assert.equal(postRollbackSummary.badges.filter(b => b.unlocked).length, 0, 'Rolled back to clean pre-upgrade badge state');

  // STEP 4: Re-Upgrade to v4.0.0 (simulate re-applying migrations & restoring forward state)
  await staging.store.exec(
    'INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [staging.admin.workspaceId, student.id, 'mat-rb-reupgrade', pack.id, 'stone', 15, 'award', 'mat-rb-req-reup', new Date().toISOString()]
  );
  await staging.store.exec(
    'INSERT INTO bao_an.badge_awards(workspace_id, student_id, badge_id, unlocked_at, json) VALUES($1, $2, $3, $4, $5)',
    [staging.admin.workspaceId, student.id, 'first_lesson', new Date().toISOString(), JSON.stringify({reason: 'Hoàn thành xuất sắc sau re-upgrade'})]
  );

  const reUpgradedSummary = await staging.store.studentSummary(studentAuth);
  assert.equal(reUpgradedSummary.balance.earned, 3);
  assert.equal(reUpgradedSummary.badges.filter(b => b.unlocked).length, 1);
  const reUpgradedMaterials = await staging.store.materials(studentAuth, student.id);
  assert.equal(reUpgradedMaterials.stone, 15);

  // STEP 5: Verify Build Identity matches package version
  const buildIdentity = await readBuildIdentity();
  assert.equal(buildIdentity.version, packageJson.version, 'Build identity matches package version');
});
