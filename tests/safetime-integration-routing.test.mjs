import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { OnlineStore } from '../server/online-store.mjs';
import { createOnlineServer } from '../server/online-server.mjs';
import { createSafeTimeIntegrationRouter, isLoopbackAddress } from '../server/safetime-integration.mjs';
import { ONLINE_RUNTIME_VERSION } from '../server/api-diagnostics.mjs';

function setupWorkspaceWithStudents(store) {
  const workspaceId = randomUUID();
  const now = new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id, name, created_at) VALUES(?, ?, ?)').run(workspaceId, 'Trường Thực Nghiệm', now);

  const classId = randomUUID();
  store.db.prepare('INSERT INTO classes(id, workspace_id, name, grade, created_at) VALUES(?, ?, ?, ?, ?)').run(classId, workspaceId, '3A', 3, now);

  const student1Id = randomUUID();
  const user1Id = randomUUID();
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, student_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(user1Id, workspaceId, 'hocsinh_minh', 'hash1', 'student', student1Id, now);
  store.db.prepare('INSERT INTO students(id, workspace_id, class_id, name, user_id, active, created_at) VALUES(?, ?, ?, ?, ?, 1, ?)')
    .run(student1Id, workspaceId, classId, 'Minh Hoàng', user1Id, now);

  const student2Id = randomUUID();
  const user2Id = randomUUID();
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, student_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(user2Id, workspaceId, 'hocsinh_an', 'hash2', 'student', student2Id, now);
  store.db.prepare('INSERT INTO students(id, workspace_id, class_id, name, user_id, active, created_at) VALUES(?, ?, ?, ?, ?, 1, ?)')
    .run(student2Id, workspaceId, classId, 'An Nhiên', user2Id, now);

  return { workspaceId, classId, student1Id, student2Id };
}

test('Task 3B.2 (BAO-05): Loopback address validation', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('192.168.1.100'), false);
  assert.equal(isLoopbackAddress('10.0.0.1'), false);
  assert.equal(isLoopbackAddress('8.8.8.8'), false);
  assert.equal(isLoopbackAddress(''), false);
  assert.equal(isLoopbackAddress(null), false);
  assert.equal(isLoopbackAddress(undefined), false);
});

test('Task 3B.2 (BAO-01, BAO-05, BAO-06): Direct Router unit test', async (t) => {
  const store = new OnlineStore(':memory:');
  t.after(() => store.close());
  const { workspaceId, student1Id, student2Id } = setupWorkspaceWithStudents(store);

  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // Helper to mock req/res
  function mockRequestResponse({ remoteAddress = '127.0.0.1', path, method = 'GET', headers = {}, body = null }) {
    const req = {
      socket: { remoteAddress },
      headers: { ...headers },
      method,
      async *[Symbol.asyncIterator]() {
        if (body !== null) {
          const buffer = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
          yield buffer;
        }
      }
    };
    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = '';
    const res = {
      writeHead(code, hdrs) {
        statusCode = code;
        Object.assign(responseHeaders, hdrs);
      },
      end(chunk) {
        if (chunk) responseBody += chunk;
      }
    };
    return { req, res, getResult: () => ({ status: statusCode, headers: responseHeaders, json: responseBody ? JSON.parse(responseBody) : null, raw: responseBody }) };
  }

  // 1. Remote rejection (BAO-05)
  {
    const { req, res, getResult } = mockRequestResponse({
      remoteAddress: '192.168.1.45',
      path: '/api/integration/safetime/v1/status',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/status', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'forbidden_remote');
  }

  // 2. Unsupported version prefix (BAO-06)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v2/status',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v2/status', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 404);
    assert.equal(result.json.error.code, 'unsupported_version');
  }

  // 3. Status check when disabled/unpaired (BAO-01, BAO-06)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/status',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/status', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.equal(result.json.version, ONLINE_RUNTIME_VERSION);
    assert.equal(result.json.integrationVersion, 1);
    assert.equal(result.json.paired, false);
  }

  // 4. Pair when portal is not yet enabled by parent (BAO-01)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/pair',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { code: '12345678', deviceName: 'PC-PHONG-KHACH', deviceId: 'dev-001' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'integration_disabled');
  }

  // Parent enables portal by creating a pair code (BAO-01, BAO-02)
  const pairCodeObj = store.createIntegrationPairCode(workspaceId, [student1Id], 10);
  assert.ok(pairCodeObj.code);

  // 5. Brute force lock test: 5 wrong attempts locks for 15 minutes (BAO-05)
  for (let i = 1; i <= 5; i++) {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/pair',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { code: 'WRONG123', deviceName: 'PC-PHONG-KHACH', deviceId: 'dev-001' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'invalid_pair_code');
  }

  // 6th attempt is locked (429) (BAO-05)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/pair',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { code: pairCodeObj.code, deviceName: 'PC-PHONG-KHACH', deviceId: 'dev-001' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 429);
    assert.equal(result.json.error.code, 'pair_locked');
  }

  // Reset security state for subsequent valid tests
  router.resetSecurityState();

  // 6. Valid Pair command (POST /pair) (BAO-04, BAO-06)
  let clientToken = '';
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/pair',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { code: pairCodeObj.code, deviceName: 'SafeTime-PC1', deviceId: 'hw-id-uuid-123' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.ok(result.json.token);
    assert.equal(result.json.token.length, 64); // 32 random bytes as hex
    clientToken = result.json.token;
    assert.equal(result.json.workspace.id, workspaceId);
    assert.equal(result.json.workspace.name, 'Trường Thực Nghiệm');
    assert.equal(result.json.students.length, 1);
    assert.equal(result.json.students[0].id, student1Id);
    assert.equal(result.json.students[0].displayName, 'Minh Hoàng');
    assert.equal(result.json.students[0].className, '3A');

    // Verify token hash is stored, NOT the plaintext token (BAO-04)
    const clientInDb = store.findIntegrationClientByTokenHash(createHash('sha256').update(clientToken).digest('hex'));
    assert.ok(clientInDb);
    assert.equal(clientInDb.device_name, 'SafeTime-PC1');
    assert.equal(clientInDb.device_id, 'hw-id-uuid-123');

    // Verify pair code is consumed
    const consumedCode = store.findIntegrationPairCode(pairCodeObj.code);
    assert.ok(consumedCode.used_at);
  }

  // Pair code cannot be reused (one-time use)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/pair',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { code: pairCodeObj.code, deviceName: 'SafeTime-PC2', deviceId: 'hw-id-uuid-456' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 400);
    assert.equal(result.json.error.code, 'invalid_pair_code');
  }

  // 7. Status now reports paired: true (BAO-06)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/status',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/status', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.equal(result.json.paired, true);
  }

  // 8. GET /students without auth -> 401 unauthorized (BAO-04)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/students',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/students', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 401);
    assert.equal(result.json.error.code, 'unauthorized');
  }

  // 9. GET /students with invalid token -> 401 unauthorized (BAO-04)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/students',
      method: 'GET',
      headers: { authorization: 'Bearer badtoken123456789' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/students', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 401);
    assert.equal(result.json.error.code, 'unauthorized');
  }

  // 10. GET /students with valid Bearer token -> returns allowed students (BAO-06)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/students',
      method: 'GET',
      headers: { authorization: `Bearer ${clientToken}` }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/students', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.equal(result.json.length, 1);
    assert.equal(result.json[0].id, student1Id);
    assert.equal(result.json[0].displayName, 'Minh Hoàng');
    assert.equal(result.json[0].className, '3A');
  }

  // 11. Rate limit test: 120 calls allowed, 121st rejected with 429 (BAO-05)
  for (let i = 0; i < 119; i++) {
    const { req, res } = mockRequestResponse({
      path: '/api/integration/safetime/v1/students',
      method: 'GET',
      headers: { authorization: `Bearer ${clientToken}` }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/students', method: 'GET' });
  }
  // 121st call:
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/students',
      method: 'GET',
      headers: { authorization: `Bearer ${clientToken}` }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/students', method: 'GET' });
    const result = getResult();
    assert.equal(result.status, 429);
    assert.equal(result.json.error.code, 'rate_limited');
  }

  // Reset rate limit for subsequent disconnection test
  router.resetSecurityState();

  // 12. DELETE /pair (disconnection) (BAO-03, BAO-06)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/pair',
      method: 'DELETE',
      headers: { authorization: `Bearer ${clientToken}` }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/pair', method: 'DELETE' });
    const result = getResult();
    assert.equal(result.status, 204);

    // Calling GET /students with revoked token now returns 401
    const { req: req2, res: res2, getResult: getResult2 } = mockRequestResponse({
      path: '/api/integration/safetime/v1/students',
      method: 'GET',
      headers: { authorization: `Bearer ${clientToken}` }
    });
    await router.handle(req2, res2, { path: '/api/integration/safetime/v1/students', method: 'GET' });
    assert.equal(getResult2().status, 401);

    // Status now reports paired: false
    const { req: req3, res: res3, getResult: getResult3 } = mockRequestResponse({
      path: '/api/integration/safetime/v1/status',
      method: 'GET'
    });
    await router.handle(req3, res3, { path: '/api/integration/safetime/v1/status', method: 'GET' });
    assert.equal(getResult3().json.paired, false);
  }
});

test('Task 3B.2 (BAO-01, BAO-05, BAO-06): Real HTTP Server loopback end-to-end integration', async (t) => {
  const server = createOnlineServer({ databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  t.after(() => {
    server.close();
    server.onlineClose();
  });

  const { workspaceId, student1Id, student2Id } = setupWorkspaceWithStudents(server.onlineStore);

  // 1. HTTP GET /api/integration/safetime/v1/status
  const res1 = await fetch(`${origin}/api/integration/safetime/v1/status`);
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.version, ONLINE_RUNTIME_VERSION);
  assert.equal(data1.integrationVersion, 1);
  assert.equal(data1.paired, false);

  // 2. Parent generates a pairing code
  const pairCodeObj = server.onlineStore.createIntegrationPairCode(workspaceId, [student1Id, student2Id], 10);

  // 3. HTTP POST /api/integration/safetime/v1/pair from desktop client
  const res2 = await fetch(`${origin}/api/integration/safetime/v1/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: pairCodeObj.code,
      deviceName: 'SafeTime-Windows-App',
      deviceId: 'device-guid-9999'
    })
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.ok(data2.token);
  assert.equal(data2.workspace.id, workspaceId);
  assert.equal(data2.students.length, 2);
  const token = data2.token;

  // 4. HTTP GET /api/integration/safetime/v1/students with Bearer token
  const res3 = await fetch(`${origin}/api/integration/safetime/v1/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res3.status, 200);
  const students = await res3.json();
  assert.equal(students.length, 2);
  assert.deepEqual(students.map(s => s.displayName).sort(), ['An Nhiên', 'Minh Hoàng']);

  // 5. HTTP GET /api/integration/safetime/v1/status now paired: true
  const res4 = await fetch(`${origin}/api/integration/safetime/v1/status`);
  assert.equal(res4.status, 200);
  const data4 = await res4.json();
  assert.equal(data4.paired, true);

  // 6. HTTP DELETE /api/integration/safetime/v1/pair
  const res5 = await fetch(`${origin}/api/integration/safetime/v1/pair`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res5.status, 204);

  // 7. Token is now revoked
  const res6 = await fetch(`${origin}/api/integration/safetime/v1/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res6.status, 401);
  const err6 = await res6.json();
  assert.equal(err6.error.code, 'unauthorized');
});
