import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { OnlineStore } from '../server/online-store.mjs';
import { PostgresStore } from '../server/postgres-store.mjs';
import { createPostgresFixture } from './helpers/postgres-fixture.mjs';
import {
  TOWN_BUILDING_CATALOG,
  TOWN_BUILDING_MAP,
  resolveTownSubject,
  getMaterialForSubject,
  calculateEarnedMaterialsFromAwards,
  calculateTotalSpentMaterials,
  calculateAvailableMaterials,
  canAffordBuilding,
  defaultTownState,
  evaluateBuildingPlacement,
} from '../server/town-data.mjs';

test('TOWN-01: Pure material calculations by subject and catalog pricing', () => {
  assert.equal(getMaterialForSubject('math'), 'stone');
  assert.equal(getMaterialForSubject('Toán'), 'stone');
  assert.equal(getMaterialForSubject('vietnamese'), 'wood');
  assert.equal(getMaterialForSubject('Tiếng Việt'), 'wood');
  assert.equal(getMaterialForSubject('english'), 'fish');
  assert.equal(getMaterialForSubject('Tiếng Anh'), 'fish');
  assert.equal(getMaterialForSubject('computing'), 'component');
  assert.equal(getMaterialForSubject('Tin học'), 'component');

  // Verify 12 buildings exist
  assert.equal(TOWN_BUILDING_CATALOG.length, 12);
  const largeBuildings = TOWN_BUILDING_CATALOG.filter((b) => b.isLarge);
  assert.ok(largeBuildings.length >= 4, 'Must have at least 4 large buildings');

  // Verify all large buildings require materials from 2-3 subjects
  for (const lb of largeBuildings) {
    const requiredMaterials = Object.keys(lb.cost);
    assert.ok(
      requiredMaterials.length >= 2,
      `Large building ${lb.id} must require at least 2 subjects (found ${requiredMaterials.length})`
    );
  }

  // Pure awards calculation
  const dummyAwards = [
    { packId: 'p1', tier: 3, questionLedger: { earnedStars: 3 } }, // math
    { packId: 'p2', tier: 2, questionLedger: { earnedStars: 2 } }, // vietnamese
    { packId: 'p3', tier: 3, questionLedger: { earnedStars: 3 } }, // english
    { packId: 'p4', tier: 1, questionLedger: { earnedStars: 1 } }, // computing
  ];

  const resolver = (id) => {
    if (id === 'p1') return 'math';
    if (id === 'p2') return 'vietnamese';
    if (id === 'p3') return 'english';
    if (id === 'p4') return 'computing';
    return 'math';
  };

  const earned = calculateEarnedMaterialsFromAwards(dummyAwards, resolver);
  assert.deepEqual(earned, { stone: 3, wood: 2, fish: 3, component: 1 });

  // Spending calculations
  const buildings = [
    { id: 'b1', buildingId: 'cottage', x: 0, y: 0, placedAt: '2026-11-05T00:00:00Z' }, // 3 wood
    { id: 'b2', buildingId: 'water_well', x: 1, y: 1, placedAt: '2026-11-05T00:00:00Z' }, // 3 stone
  ];

  const spent = calculateTotalSpentMaterials(buildings);
  assert.deepEqual(spent, { stone: 3, wood: 3, fish: 0, component: 0 });

  const available = calculateAvailableMaterials(
    { stone: 10, wood: 10, fish: 5, component: 5 },
    spent
  );
  assert.deepEqual(available, { stone: 7, wood: 7, fish: 5, component: 5 });

  // Affordability
  assert.equal(canAffordBuilding({ stone: 2, wood: 1, fish: 0, component: 0 }, { stone: 3 }), false);
  assert.equal(canAffordBuilding({ stone: 3, wood: 1, fish: 0, component: 0 }, { stone: 3 }), true);
});

test('TOWN-02: evaluateBuildingPlacement validation and optimistic locking', () => {
  const town = defaultTownState('st_1', '2026-11-05T00:00:00Z');
  assert.equal(town.gridWidth, 10);
  assert.equal(town.gridHeight, 10);
  assert.equal(town.revision, 1);

  // Out of grid bounds
  assert.throws(
    () =>
      evaluateBuildingPlacement({
        currentTownState: town,
        buildingId: 'cottage',
        x: 10,
        y: 5,
        availableMaterials: { stone: 10, wood: 10, fish: 10, component: 10 },
        nowIso: '2026-11-05T00:00:00Z',
        placementId: 'p1',
      }),
    /Tọa độ/
  );

  // Insufficient materials
  assert.throws(
    () =>
      evaluateBuildingPlacement({
        currentTownState: town,
        buildingId: 'cottage',
        x: 0,
        y: 0,
        availableMaterials: { stone: 0, wood: 0, fish: 0, component: 0 },
        nowIso: '2026-11-05T00:00:00Z',
        placementId: 'p1',
      }),
    /Không đủ vật liệu/
  );

  // Valid placement
  const result = evaluateBuildingPlacement({
    currentTownState: town,
    buildingId: 'cottage',
    x: 2,
    y: 3,
    expectedRevision: 1,
    availableMaterials: { stone: 10, wood: 10, fish: 10, component: 10 },
    nowIso: '2026-11-05T00:00:00Z',
    placementId: 'p1',
  });

  assert.equal(result.updatedTownState.revision, 2);
  assert.equal(result.updatedTownState.buildings.length, 1);
  assert.deepEqual(result.cost, { wood: 3 });

  // Cell occupied collision
  assert.throws(
    () =>
      evaluateBuildingPlacement({
        currentTownState: result.updatedTownState,
        buildingId: 'water_well',
        x: 2,
        y: 3,
        expectedRevision: 2,
        availableMaterials: { stone: 10, wood: 10, fish: 10, component: 10 },
        nowIso: '2026-11-05T00:00:00Z',
        placementId: 'p2',
      }),
    /Vị trí này đã có công trình/
  );

  // Revision mismatch (Optimistic concurrency conflict)
  assert.throws(
    () =>
      evaluateBuildingPlacement({
        currentTownState: result.updatedTownState, // revision is 2
        buildingId: 'water_well',
        x: 5,
        y: 5,
        expectedRevision: 1, // Stale revision from concurrent tab!
        availableMaterials: { stone: 10, wood: 10, fish: 10, component: 10 },
        nowIso: '2026-11-05T00:00:00Z',
        placementId: 'p2',
      }),
    (err) => err.status === 409 && err.code === 'REVISION_CONFLICT'
  );
});

test('TOWN-03: SQLite OnlineStore full town journey, wallet star safety, and recalculation gate', () => {
  const store = new OnlineStore(':memory:');
  const admin = { workspaceId: 'ws-town', id: 'admin-1', role: 'admin' };
  store.db.exec("INSERT INTO workspaces(id,name,wallet_enabled,rate_vnd,created_at) VALUES('ws-town','Trường mẫu',1,1000,'2026-10-01')");
  store.db.exec("INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES('u-admin','ws-town','admin','pwd','admin','2026-10-01')");

  const cls = store.createClass(admin, { name: 'Lớp 3A', grade: 3 });
  const student = store.createStudent(admin, { classId: cls.id, name: 'Bảo An', username: 'baoan' }, 'pwd', 'baoan');
  const studentAuth = { workspaceId: 'ws-town', role: 'student', id: student.id, studentId: student.id };

  // Enable wallet to track stars
  store.configureWallet(admin, { enabled: true, rateVnd: 1000 });

  // Insert packs directly for 4 subjects
  store.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run('ws-town', 'pack_math', 1, 'Toán', JSON.stringify({ id: 'pack_math', subject: 'math' }), 'hash1');
  store.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run('ws-town', 'pack_viet', 1, 'Tiếng Việt', JSON.stringify({ id: 'pack_viet', subject: 'vietnamese' }), 'hash2');
  store.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run('ws-town', 'pack_eng', 1, 'Tiếng Anh', JSON.stringify({ id: 'pack_eng', subject: 'english' }), 'hash3');
  store.db.prepare('INSERT INTO packs VALUES(?,?,?,?,?,?)').run('ws-town', 'pack_comp', 1, 'Tin học', JSON.stringify({ id: 'pack_comp', subject: 'computing' }), 'hash4');

  // Award stars to student:
  // Math: 3 stars -> 3 stones
  // Vietnamese: 3 stars -> 3 wood
  // English: 2 stars -> 2 fish
  // Computing: 1 star -> 1 component
  store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run('ws-town', student.id, 'pack_math', 3, JSON.stringify({ packId: 'pack_math', starTier: 3, questionLedger: { policyVersion: 2, packId: 'pack_math', legacyStars: 3, questionTiers: { q1: 3 }, earnedStars: 3 } }));
  store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run('ws-town', student.id, 'pack_viet', 3, JSON.stringify({ packId: 'pack_viet', starTier: 3, questionLedger: { policyVersion: 2, packId: 'pack_viet', legacyStars: 3, questionTiers: { q2: 3 }, earnedStars: 3 } }));
  store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run('ws-town', student.id, 'pack_eng', 2, JSON.stringify({ packId: 'pack_eng', starTier: 2, questionLedger: { policyVersion: 2, packId: 'pack_eng', legacyStars: 2, questionTiers: { q3: 2 }, earnedStars: 2 } }));
  store.db.prepare('INSERT INTO awards VALUES(?,?,?,?,?)').run('ws-town', student.id, 'pack_comp', 1, JSON.stringify({ packId: 'pack_comp', starTier: 1, questionLedger: { policyVersion: 2, packId: 'pack_comp', legacyStars: 1, questionTiers: { q4: 1 }, earnedStars: 1 } }));

  // Check initial materials (auto-initialized from awards)
  const initialMaterials = store.materials(studentAuth, student.id);
  assert.deepEqual(initialMaterials, { stone: 3, wood: 3, fish: 2, component: 1 });

  // Check wallet available stars before building
  const summaryBefore = store.townSummary(studentAuth, student.id);
  const starsBefore = summaryBefore.walletAvailableStars;
  assert.equal(starsBefore, 9); // 3 + 3 + 2 + 1 = 9 stars

  // Tab 1 & Tab 2 concurrency simulation:
  // Both tabs load town state at revision 1
  const townTab1 = store.townState(studentAuth, student.id);
  const townTab2 = store.townState(studentAuth, student.id);
  assert.equal(townTab1.revision, 1);
  assert.equal(townTab2.revision, 1);

  // Tab 1 places cottage (cost: 3 wood) at (1, 1) with expectedRevision: 1
  const tab1Result = store.placeBuilding(studentAuth, student.id, {
    buildingId: 'cottage',
    x: 1,
    y: 1,
    expectedRevision: 1,
    requestId: 'req_tab_1',
  });
  assert.equal(tab1Result.ok, true);
  assert.equal(tab1Result.town.revision, 2);
  assert.equal(tab1Result.materials.wood, 0); // 3 - 3 = 0 wood left

  // Tab 2 attempts to place another building at (2, 2) with stale expectedRevision: 1
  assert.throws(
    () =>
      store.placeBuilding(studentAuth, student.id, {
        buildingId: 'ancient_tree',
        x: 2,
        y: 2,
        expectedRevision: 1, // Stale!
        requestId: 'req_tab_2',
      }),
    (err) => err.status === 409 && err.code === 'REVISION_CONFLICT'
  );

  // Verify Tab 2's failed attempt DID NOT deduct any materials
  const currentMaterials = store.materials(studentAuth, student.id);
  assert.deepEqual(currentMaterials, { stone: 3, wood: 0, fish: 2, component: 1 });

  // GATE C8 CRITICAL: Verify building DOES NOT change wallet available stars
  const summaryAfter = store.townSummary(studentAuth, student.id);
  assert.equal(
    summaryAfter.walletAvailableStars,
    starsBefore,
    'Building in town must NOT deduct wallet stars!'
  );

  // GATE C8 CRITICAL: Delete materials_ledger and recalculate from awards
  store.db.prepare('DELETE FROM materials_ledger WHERE workspace_id=? AND student_id=?').run('ws-town', student.id);
  const ledgerCount = store.db.prepare('SELECT count(*) as c FROM materials_ledger WHERE workspace_id=? AND student_id=?').get('ws-town', student.id).c;
  assert.equal(ledgerCount, 0, 'Ledger must be completely empty');

  // Recalculate
  const restoredMaterials = store.recalculateMaterials(studentAuth, student.id);
  assert.deepEqual(
    restoredMaterials,
    { stone: 3, wood: 0, fish: 2, component: 1 },
    'Recalculating from awards and placed buildings must restore exact available balances'
  );

  store.close();
});

test('TOWN-04: PostgreSQL Store town state, optimistic concurrency, and recalculation', async (t) => {
  const f = await createPostgresFixture(t);
  const cls = await f.store.createClass(f.admin, { name: 'Lớp 3B', grade: 3 });
  const s1 = await f.store.createStudent(f.admin, { classId: cls.id, name: 'Bảo Minh', username: 'baominh-pg' }, 'pwd', 'baominh-pg');
  const st1 = await f.store.student(f.admin, s1.id);
  const studentAuth = { workspaceId: f.admin.workspaceId, role: 'student', id: st1.user_id, studentId: s1.id };

  // Insert packs directly for 2 subjects
  await f.store.exec('INSERT INTO bao_an.packs(workspace_id, pack_id, version, subject_label, json, content_hash) VALUES($1,$2,$3,$4,$5::jsonb,$6)', [
    f.admin.workspaceId, 'pg_pack_math', 1, 'Toán', JSON.stringify({ id: 'pg_pack_math', subject: 'math' }), 'hash1'
  ]);
  await f.store.exec('INSERT INTO bao_an.packs(workspace_id, pack_id, version, subject_label, json, content_hash) VALUES($1,$2,$3,$4,$5::jsonb,$6)', [
    f.admin.workspaceId, 'pg_pack_viet', 1, 'Tiếng Việt', JSON.stringify({ id: 'pg_pack_viet', subject: 'vietnamese' }), 'hash2'
  ]);

  // Insert awards: 3 stars math, 5 stars vietnamese
  await f.store.exec('INSERT INTO bao_an.awards(workspace_id, student_id, pack_id, tier, json) VALUES($1,$2,$3,$4,$5::jsonb)', [
    f.admin.workspaceId, s1.id, 'pg_pack_math', 3, JSON.stringify({ starTier: 3, questionLedger: { earnedStars: 3 } })
  ]);
  await f.store.exec('INSERT INTO bao_an.awards(workspace_id, student_id, pack_id, tier, json) VALUES($1,$2,$3,$4,$5::jsonb)', [
    f.admin.workspaceId, s1.id, 'pg_pack_viet', 3, JSON.stringify({ starTier: 3, questionLedger: { earnedStars: 5 } })
  ]);

  // Read materials
  const mat = await f.store.materials(studentAuth, s1.id);
  assert.equal(mat.stone, 3);
  assert.equal(mat.wood, 5);

  // Place building (water_well: 3 stone)
  const placeRes = await f.store.placeBuilding(studentAuth, s1.id, {
    buildingId: 'water_well',
    x: 0,
    y: 0,
    expectedRevision: 1,
    requestId: 'pg_req_1',
  });
  assert.equal(placeRes.ok, true);
  assert.equal(placeRes.town.revision, 2);
  assert.equal(placeRes.materials.stone, 0);

  // Optimistic concurrency conflict on revision 1
  await assert.rejects(
    async () => {
      await f.store.placeBuilding(studentAuth, s1.id, {
        buildingId: 'cottage',
        x: 1,
        y: 1,
        expectedRevision: 1, // Stale!
        requestId: 'pg_req_2',
      });
    },
    (err) => err.status === 409 && err.code === 'REVISION_CONFLICT'
  );

  // Recalculation gate on PostgreSQL
  await f.store.exec('DELETE FROM bao_an.materials_ledger WHERE workspace_id=$1 AND student_id=$2', [f.admin.workspaceId, s1.id]);
  const restored = await f.store.recalculateMaterials(studentAuth, s1.id);
  assert.deepEqual(restored, { stone: 0, wood: 5, fish: 0, component: 0 });
});

test('TOWN-05: Cloud API /town endpoints and revision conflict response', async (t) => {
  const f = await createPostgresFixture(t);
  const { createCloudApi } = await import('../server/cloud-api.mjs');
  const handler = createCloudApi({ store: f.store, publicOrigin: 'https://bao-an-learning.local' });

  const cls = await f.store.createClass(f.admin, { name: 'Lớp 3C', grade: 3 });
  const s1 = await f.store.createStudent(f.admin, { classId: cls.id, name: 'Bảo Trâm', username: 'baotram' }, 'pwd', 'baotram');
  const st1 = await f.store.student(f.admin, s1.id);
  const studentAuth = { workspaceId: f.admin.workspaceId, id: st1.user_id, studentId: s1.id, role: 'student' };

  // Helper for invoking handler with valid session
  const token = '1234567890123456789012345678901234567890123456789012345678901234';
  const tokenHash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
  const csrf = 'csrf-test-token';
  await f.store.createSession({
    tokenHash,
    userId: st1.user_id,
    csrfToken: csrf,
    expiresAt: Date.now() + 3600000,
    passwordHash: 'pwd',
    workspaceId: f.admin.workspaceId,
  });

  const invoke = async (path, method = 'GET', body = null) => {
    const origin = 'https://bao-an-learning.local';
    const authReq = new Request(`${origin}/api/online${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'origin': origin,
        'cookie': `baoan_online_session=${token}`,
        'x-csrf-token': csrf,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const res = await handler(authReq, {});
    const data = await res.json();
    return { status: res.status, data };
  };

  // 1. GET /town
  const getTown = await invoke('/town');
  assert.equal(getTown.status, 200);
  assert.equal(getTown.data.town.gridWidth, 10);
  assert.equal(getTown.data.town.gridHeight, 10);
  assert.equal(getTown.data.town.revision, 1);
  assert.equal(getTown.data.catalog.length, 12);

  // 2. Add some materials
  await f.store.exec('INSERT INTO bao_an.materials_ledger(workspace_id, student_id, id, pack_id, material_type, delta, reason, request_id, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
    f.admin.workspaceId, s1.id, 'tx_1', null, 'wood', 10, 'award', 'award_wood_10', new Date().toISOString()
  ]);

  // 3. POST /town/build
  const buildRes = await invoke('/town/build', 'POST', {
    buildingId: 'cottage',
    x: 3,
    y: 3,
    expectedRevision: 1,
    requestId: 'http_req_1',
  });
  if (buildRes.status !== 200) console.log('buildRes error:', buildRes.data);
  assert.equal(buildRes.status, 200);
  assert.equal(buildRes.data.town.revision, 2);
  assert.equal(buildRes.data.materials.wood, 7); // 10 - 3 = 7

  // 4. POST /town/build with stale revision 1 -> 409 Conflict
  const conflictRes = await invoke('/town/build', 'POST', {
    buildingId: 'ancient_tree',
    x: 4,
    y: 4,
    expectedRevision: 1, // Stale!
    requestId: 'http_req_2',
  });
  assert.equal(conflictRes.status, 409);
  assert.match(conflictRes.data.error, /thiết bị khác/);

  // 5. POST /town/recalculate
  const recalcRes = await invoke('/town/recalculate', 'POST', {});
  assert.equal(recalcRes.status, 200);
});

