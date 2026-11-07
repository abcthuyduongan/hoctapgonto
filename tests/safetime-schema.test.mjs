import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {OnlineStore} from '../server/online-store.mjs';
import {snapshotOnlineDatabase, restoreOnlineDatabase} from '../server/online-recovery.mjs';

test('Task 3B.1 (BAO-04, BAO-14): SQLite migration to version 2 with integration tables', async () => {
  const store = new OnlineStore(':memory:');
  try {
    const versionRow = store.db.prepare('SELECT max(version) AS version FROM schema_version').get();
    assert.equal(versionRow.version, 2, 'SQLite schema_version must be 2');

    const tables = store.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const requiredTables = [
      'integration_clients',
      'integration_pair_codes',
      'integration_tickets',
      'integration_refresh_tokens',
      'integration_events'
    ];
    for (const table of requiredTables) {
      assert.ok(tables.includes(table), `Table ${table} must exist in SQLite`);
    }

    const indexes = store.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(r => r.name);
    assert.ok(indexes.includes('integration_clients_token'));
    assert.ok(indexes.includes('integration_pair_codes_expiry'));
    assert.ok(indexes.includes('integration_tickets_lookup'));
    assert.ok(indexes.includes('integration_refresh_lookup'));
    assert.ok(indexes.includes('integration_events_lookup'));
  } finally {
    store.close();
  }
});

test('Task 3B.1 (BAO-04): Pairing codes, clients, tickets, refresh tokens and events CRUD', async () => {
  const store = new OnlineStore(':memory:');
  try {
    const workspaceId = randomUUID();
    const adminId = randomUUID();
    const nowIso = new Date().toISOString();

    store.db.prepare('INSERT INTO workspaces(id, name, created_at) VALUES (?, ?, ?)').run(workspaceId, 'Trường Test', nowIso);
    store.db.prepare("INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)").run(adminId, workspaceId, 'admin_test', 'hash', nowIso);
    const admin = { id: adminId, workspaceId, role: 'admin' };
    const cls = store.createClass(admin, { name: 'Lớp 3A', grade: 3 });
    const st1 = store.createStudent(admin, { name: 'Bảo An', classId: cls.id, username: 'baoan' }, 'salt:hash', 'baoan');
    const st2 = store.createStudent(admin, { name: 'Minh', classId: cls.id, username: 'minh' }, 'salt:hash', 'minh');

    // 1. Tạo mã ghép đôi (BAO-02)
    const pair = store.createIntegrationPairCode(workspaceId, [st1.id, st2.id], 10);
    assert.equal(pair.code.length, 8);
    assert.deepEqual(pair.allowedStudentIds, [st1.id, st2.id]);

    const foundPair = store.findIntegrationPairCode(pair.code);
    assert.ok(foundPair);
    assert.deepEqual(foundPair.allowed_student_ids, [st1.id, st2.id]);
    assert.equal(foundPair.used_at, null);

    // Dùng mã ghép đôi
    const consumedPair = store.consumeIntegrationPairCode(pair.code);
    assert.ok(consumedPair.used_at);
    // Dùng lại phải bị từ chối
    assert.throws(() => store.consumeIntegrationPairCode(pair.code), /đã được sử dụng/);

    // 2. Tạo client kết nối (BAO-04: chỉ lưu SHA-256 của token)
    const rawToken = 'secret-32-byte-token-from-safetime-app-1234';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const client = store.createIntegrationClient(workspaceId, {
      tokenHash,
      deviceId: 'dev_laptop_con_1',
      deviceName: 'Laptop Con Trai',
      allowedStudentIds: [st1.id]
    });
    assert.ok(client.id);
    assert.equal(client.token_hash, tokenHash);
    assert.deepEqual(client.allowed_student_ids, [st1.id]);

    const foundClient = store.findIntegrationClientByTokenHash(tokenHash);
    assert.ok(foundClient);
    assert.equal(foundClient.id, client.id);

    // 3. Tạo vé SSO (BAO-08)
    const ticketRes = store.createIntegrationTicket(workspaceId, client.id, st1.id, 60);
    assert.ok(ticketRes.ticket);

    const consumedTicket = store.consumeIntegrationTicket(ticketRes.ticket);
    assert.equal(consumedTicket.client_id, client.id);
    assert.equal(consumedTicket.student_id, st1.id);
    assert.ok(consumedTicket.used_at);

    // Vé SSO dùng lại bị từ chối
    assert.throws(() => store.consumeIntegrationTicket(ticketRes.ticket), /đã được sử dụng/);

    // 4. Mã làm mới (Refresh Token) và xoay vòng (BAO-08)
    const refreshRes = store.createIntegrationRefreshToken(workspaceId, client.id, st1.id, 30);
    assert.ok(refreshRes.rawToken);

    // Dùng mã làm mới thành công
    const consumedRefresh = store.consumeIntegrationRefreshToken(refreshRes.rawToken);
    assert.equal(consumedRefresh.client_id, client.id);
    assert.equal(consumedRefresh.student_id, st1.id);

    // Dùng lại mã làm mới cũ bị từ chối (đã bị xoay vòng / thu hồi)
    assert.throws(() => store.consumeIntegrationRefreshToken(refreshRes.rawToken), /không hợp lệ hoặc đã bị thu hồi/);

    // 5. Ghi nhận sự kiện tích hợp (BAO-12)
    const ev1 = store.recordIntegrationEvent(workspaceId, st1.id, 'contest_submitted', {
      sessionId: 'sess_1',
      presetId: 'violympic-toan-3',
      score: 280,
      maxScore: 300
    });
    const ev2 = store.recordIntegrationEvent(workspaceId, st1.id, 'week_completed', {
      subject: 'toan',
      week: 5
    });
    assert.ok(ev1.id);
    assert.ok(ev2.id);

    const eventList = store.listIntegrationEvents(workspaceId, { limit: 10 });
    assert.equal(eventList.events.length, 2);
    assert.equal(eventList.events[0].type, 'contest_submitted');
    assert.equal(eventList.events[0].data.score, 280);
    assert.equal(eventList.events[1].type, 'week_completed');

    // 6. Thu hồi client (BAO-03)
    const activeRefresh = store.createIntegrationRefreshToken(workspaceId, client.id, st1.id, 30);
    store.revokeIntegrationClient(client.id);

    // Client đã bị thu hồi không tìm thấy theo token_hash
    assert.equal(store.findIntegrationClientByTokenHash(tokenHash), null);
    // Refresh token của client đã thu hồi cũng không dùng được
    assert.throws(() => store.consumeIntegrationRefreshToken(activeRefresh.rawToken), /không hợp lệ hoặc đã bị thu hồi/);
  } finally {
    store.close();
  }
});

test('Task 3B.1 (BAO-14): Backup and Restore clears integration credentials requiring re-pairing', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'baoan-integration-recovery-'));
  const sourceDbPath = join(tempDir, 'source.sqlite');
  const backupPath = join(tempDir, 'backup.sqlite');
  const restoreDbPath = join(tempDir, 'restored.sqlite');

  const store = new OnlineStore(sourceDbPath);
  try {
    const workspaceId = randomUUID();
    const adminId = randomUUID();
    const nowIso = new Date().toISOString();

    store.db.prepare('INSERT INTO workspaces(id, name, created_at) VALUES (?, ?, ?)').run(workspaceId, 'Kho Phục Hồi', nowIso);
    store.db.prepare("INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)").run(adminId, workspaceId, 'admin_bk', 'hash', nowIso);
    const admin = { id: adminId, workspaceId, role: 'admin' };
    const cls = store.createClass(admin, { name: 'Lớp 4B', grade: 4 });
    const st = store.createStudent(admin, { name: 'Nam', classId: cls.id, username: 'nam' }, 'salt:hash', 'nam');

    // Tạo các khóa kết nối và mã ghép đôi
    store.createIntegrationPairCode(workspaceId, [st.id], 10);
    const client = store.createIntegrationClient(workspaceId, {
      tokenHash: createHash('sha256').update('secret-restore').digest('hex'),
      deviceId: 'dev_test',
      deviceName: 'Device Test',
      allowedStudentIds: [st.id]
    });
    store.createIntegrationTicket(workspaceId, client.id, st.id);
    store.createIntegrationRefreshToken(workspaceId, client.id, st.id);
    store.recordIntegrationEvent(workspaceId, st.id, 'badge_unlocked', { badgeId: 'streak_5', title: '5 ngày chăm chỉ' });

    // Tạo bản sao lưu
    const snapshotInfo = await snapshotOnlineDatabase(store.db, backupPath);
    assert.equal(snapshotInfo.schemaVersion, 2);

    // Khôi phục bản sao vào vị trí mới
    const restoreResult = await restoreOnlineDatabase({
      databasePath: restoreDbPath,
      backupPath,
      expectedSha256: snapshotInfo.sha256
    });
    assert.equal(restoreResult.schemaVersion, 2);

    // Mở cơ sở dữ liệu đã khôi phục
    const restoredStore = new OnlineStore(restoreDbPath);
    try {
      // Xác minh các khóa kết nối và mã làm mới đã được xóa sạch (khôi phục buộc ghép đôi lại - BAO-14)
      const clientsCount = restoredStore.db.prepare('SELECT count(*) AS n FROM integration_clients').get().n;
      const codesCount = restoredStore.db.prepare('SELECT count(*) AS n FROM integration_pair_codes').get().n;
      const ticketsCount = restoredStore.db.prepare('SELECT count(*) AS n FROM integration_tickets').get().n;
      const refreshCount = restoredStore.db.prepare('SELECT count(*) AS n FROM integration_refresh_tokens').get().n;

      assert.equal(clientsCount, 0, 'Clients must be cleared after restore to force re-pair');
      assert.equal(codesCount, 0, 'Pair codes must be cleared after restore');
      assert.equal(ticketsCount, 0, 'Tickets must be cleared after restore');
      assert.equal(refreshCount, 0, 'Refresh tokens must be cleared after restore');

      // Sự kiện lịch sử vẫn được giữ lại
      const eventsCount = restoredStore.db.prepare('SELECT count(*) AS n FROM integration_events').get().n;
      assert.equal(eventsCount, 1, 'Events history is preserved in backup');
    } finally {
      restoredStore.close();
    }
  } finally {
    store.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});
