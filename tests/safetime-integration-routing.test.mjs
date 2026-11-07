import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { OnlineStore } from '../server/online-store.mjs';
import { createOnlineServer } from '../server/online-server.mjs';
import { createSafeTimeIntegrationRouter, isLoopbackAddress, sanitizeDeepLink } from '../server/safetime-integration.mjs';
import { ONLINE_RUNTIME_VERSION } from '../server/api-diagnostics.mjs';

const scrypt = promisify(scryptCallback);
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function makePasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const result = await scrypt(password, salt, 64, scryptOptions);
  return `${salt}:${result.toString('hex')}`;
}

async function setupWorkspaceWithStudents(store) {
  const workspaceId = randomUUID();
  const now = new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id, name, created_at) VALUES(?, ?, ?)').run(workspaceId, 'Trường Thực Nghiệm', now);

  const classId = randomUUID();
  store.db.prepare('INSERT INTO classes(id, workspace_id, name, grade, created_at) VALUES(?, ?, ?, ?, ?)').run(classId, workspaceId, '3A', 3, now);

  const student1Id = randomUUID();
  const user1Id = randomUUID();
  const passHash1 = await makePasswordHash('MatKhauMinh123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, student_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(user1Id, workspaceId, 'hocsinh_minh', passHash1, 'student', student1Id, now);
  store.db.prepare('INSERT INTO students(id, workspace_id, class_id, name, user_id, active, created_at) VALUES(?, ?, ?, ?, ?, 1, ?)')
    .run(student1Id, workspaceId, classId, 'Minh Hoàng', user1Id, now);

  const student2Id = randomUUID();
  const user2Id = randomUUID();
  const passHash2 = await makePasswordHash('MatKhauAn123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, student_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(user2Id, workspaceId, 'hocsinh_an', passHash2, 'student', student2Id, now);
  store.db.prepare('INSERT INTO students(id, workspace_id, class_id, name, user_id, active, created_at) VALUES(?, ?, ?, ?, ?, 1, ?)')
    .run(student2Id, workspaceId, classId, 'An Nhiên', user2Id, now);

  // Parent user
  const parentUserId = randomUUID();
  const parentPassHash = await makePasswordHash('MatKhauPhuHuynh123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(parentUserId, workspaceId, 'phuhuynh_test', parentPassHash, 'parent', now);

  return { workspaceId, classId, student1Id, student2Id, parentUserId };
}

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
    setHeader(name, value) {
      responseHeaders[name] = value;
    },
    writeHead(code, hdrs) {
      statusCode = code;
      if (hdrs) Object.assign(responseHeaders, hdrs);
    },
    end(chunk) {
      if (chunk) responseBody += chunk;
    }
  };
  return {
    req,
    res,
    getResult: () => ({
      status: statusCode,
      headers: responseHeaders,
      json: responseBody ? JSON.parse(responseBody) : null,
      raw: responseBody
    })
  };
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
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);

  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

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
    assert.equal(result.json.token.length, 64);
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

test('Task 3B.3 (BAO-07): student-login credential check, wrong_student, rateLimit, and ticket/refreshToken generation', async (t) => {
  const store = new OnlineStore(':memory:');
  t.after(() => store.close());
  const { workspaceId, student1Id, student2Id, parentUserId } = await setupWorkspaceWithStudents(store);

  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // Create pair code allowing only student1 (Minh Hoàng)
  const pairCode = store.createIntegrationPairCode(workspaceId, [student1Id], 10);
  const { req: pairReq, res: pairRes, getResult: pairResult } = mockRequestResponse({
    path: '/api/integration/safetime/v1/pair',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { code: pairCode.code, deviceName: 'PC-Hoc-Tap', deviceId: 'dev-hoc-tap-1' }
  });
  await router.handle(pairReq, pairRes, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
  const clientToken = pairResult().json.token;
  assert.ok(clientToken);

  // 1. Without Bearer token -> 401 unauthorized
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { username: 'hocsinh_minh', password: 'MatKhauMinh123!', studentId: student1Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    assert.equal(getResult().status, 401);
  }

  // 2. Missing required fields -> 400 invalid_payload
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_minh', password: '' }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    assert.equal(getResult().status, 400);
    assert.equal(getResult().json.error.code, 'invalid_payload');
  }

  // 3. studentId not in client's allowed list -> 403 student_not_allowed (client only allowed student1Id)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_an', password: 'MatKhauAn123!', studentId: student2Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    assert.equal(getResult().status, 403);
    assert.equal(getResult().json.error.code, 'student_not_allowed');
  }

  // 4. Non-student account logging in -> 403 not_student
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { username: 'phuhuynh_test', password: 'MatKhauPhuHuynh123!', studentId: student1Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    assert.equal(getResult().status, 403);
    assert.equal(getResult().json.error.code, 'not_student');
  }

  // 5. Wrong password -> 401 invalid_credentials
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_minh', password: 'WrongPassword999!', studentId: student1Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    assert.equal(getResult().status, 401);
    assert.equal(getResult().json.error.code, 'invalid_credentials');
  }

  // 6. Wrong student (BAO-07, LNK-09): Child enters their sibling's account
  // Pair another client that allows both students to test wrong_student
  const pairCodeAll = store.createIntegrationPairCode(workspaceId, [student1Id, student2Id], 10);
  const { req: pReq2, res: pRes2, getResult: pResult2 } = mockRequestResponse({
    path: '/api/integration/safetime/v1/pair',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { code: pairCodeAll.code, deviceName: 'PC-All', deviceId: 'dev-all' }
  });
  await router.handle(pReq2, pRes2, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
  const clientTokenAll = pResult2().json.token;

  // Student An enters credentials, but studentId is Minh's ID
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientTokenAll}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_an', password: 'MatKhauAn123!', studentId: student1Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 403);
    assert.equal(result.json.error.code, 'wrong_student');
    assert.equal(result.json.error.message, 'Tài khoản này không phải của bạn trên máy này. Hỏi bố mẹ nhé.');
  }

  // 7. Successful login with remember = false (BAO-07, BAO-08)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientTokenAll}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_minh', password: 'MatKhauMinh123!', studentId: student1Id, remember: false }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.equal(result.json.student.id, student1Id);
    assert.equal(result.json.student.displayName, 'Minh Hoàng');
    assert.ok(result.json.ticket);
    assert.equal(result.json.ticket.length, 64);
    assert.equal(result.json.refreshToken, undefined);

    // Verify ticket in DB
    const ticketInDb = store.db.prepare('SELECT * FROM integration_tickets WHERE ticket = ?').get(result.json.ticket);
    assert.ok(ticketInDb);
    assert.equal(ticketInDb.student_id, student1Id);
  }

  // 8. Successful login with remember = true -> generates refreshToken (BAO-07, BAO-08)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientTokenAll}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_minh', password: 'MatKhauMinh123!', studentId: student1Id, remember: true }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.equal(result.json.student.id, student1Id);
    assert.ok(result.json.ticket);
    assert.ok(result.json.refreshToken);
    assert.equal(result.json.refreshToken.length, 64);

    // Verify refresh token hash in DB
    const refreshHash = createHash('sha256').update(result.json.refreshToken).digest('hex');
    const refreshInDb = store.db.prepare('SELECT * FROM integration_refresh_tokens WHERE token_hash = ?').get(refreshHash);
    assert.ok(refreshInDb);
    assert.equal(refreshInDb.student_id, student1Id);
  }

  // 9. Shared rate limit test (BAO-07): 12 failed attempts for username triggers 429
  // Clear any existing limit first
  store.db.prepare('DELETE FROM login_limits').run();
  for (let i = 1; i <= 12; i++) {
    const { req, res } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientTokenAll}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_an', password: 'WrongPassword!', studentId: student2Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
  }
  // 13th failure triggers 429
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-login',
      method: 'POST',
      headers: { authorization: `Bearer ${clientTokenAll}`, 'content-type': 'application/json' },
      body: { username: 'hocsinh_an', password: 'WrongPassword!', studentId: student2Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 429);
    assert.equal(result.json.error.code, 'login_rate_limited');
  }
});

test('Task 3B.4 (BAO-09): Deep-link sanitizer validation', () => {
  assert.equal(sanitizeDeepLink('hoc/toan'), 'hoc/toan');
  assert.equal(sanitizeDeepLink('hoc/tieng-viet'), 'hoc/tieng-viet');
  assert.equal(sanitizeDeepLink('hoc/tieng-anh'), 'hoc/tieng-anh');
  assert.equal(sanitizeDeepLink('hoc/tin-hoc'), 'hoc/tin-hoc');
  assert.equal(sanitizeDeepLink('nhiem-vu'), 'nhiem-vu');
  assert.equal(sanitizeDeepLink('thi/violympic-toan-3'), 'thi/violympic-toan-3');
  assert.equal(sanitizeDeepLink('thi/ioe-tieng-anh-3'), 'thi/ioe-tieng-anh-3');
  assert.equal(sanitizeDeepLink('ban-do'), 'ban-do');
  assert.equal(sanitizeDeepLink('qua'), 'qua');
  // Hash prefix removal
  assert.equal(sanitizeDeepLink('#/hoc/toan'), 'hoc/toan');
  assert.equal(sanitizeDeepLink('#qua'), 'qua');
  // Invalid values fallback to ban-do
  assert.equal(sanitizeDeepLink('evil.com'), 'ban-do');
  assert.equal(sanitizeDeepLink('../hack'), 'ban-do');
  assert.equal(sanitizeDeepLink('javascript:alert(1)'), 'ban-do');
  assert.equal(sanitizeDeepLink(''), 'ban-do');
  assert.equal(sanitizeDeepLink(null), 'ban-do');
  assert.equal(sanitizeDeepLink(undefined), 'ban-do');
});

test('Task 3B.4 (BAO-08, BAO-09): Refresh token rotation, SSO ticket redemption, and student logout', async (t) => {
  const store = new OnlineStore(':memory:');
  t.after(() => store.close());
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);

  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // Pair client
  const pairCode = store.createIntegrationPairCode(workspaceId, [student1Id, student2Id], 10);
  const { req: pReq, res: pRes, getResult: pResult } = mockRequestResponse({
    path: '/api/integration/safetime/v1/pair',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { code: pairCode.code, deviceName: 'PC-Test', deviceId: 'dev-001' }
  });
  await router.handle(pReq, pRes, { path: '/api/integration/safetime/v1/pair', method: 'POST' });
  const clientToken = pResult().json.token;

  // Log in student1 with remember = true
  const { req: lReq, res: lRes, getResult: lResult } = mockRequestResponse({
    path: '/api/integration/safetime/v1/student-login',
    method: 'POST',
    headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
    body: { username: 'hocsinh_minh', password: 'MatKhauMinh123!', studentId: student1Id, remember: true }
  });
  await router.handle(lReq, lRes, { path: '/api/integration/safetime/v1/student-login', method: 'POST' });
  const { ticket: initialTicket, refreshToken: initialRefreshToken } = lResult().json;
  assert.ok(initialTicket);
  assert.ok(initialRefreshToken);

  // 1. GET /sso without ticket -> 400 missing_ticket (BAO-08)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/sso',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/sso', method: 'GET', url: new URL('http://127.0.0.1/api/integration/safetime/v1/sso') });
    assert.equal(getResult().status, 400);
    assert.equal(getResult().json.error.code, 'missing_ticket');
  }

  // 2. GET /sso with valid ticket -> 302 redirect + Set-Cookie (BAO-08, BAO-09)
  {
    const ssoUrl = new URL(`http://127.0.0.1/api/integration/safetime/v1/sso?ticket=${initialTicket}&to=hoc/toan`);
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/sso',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/sso', method: 'GET', url: ssoUrl, origin: 'http://127.0.0.1' });
    const result = getResult();
    assert.equal(result.status, 302);
    assert.equal(result.headers.Location, '/?online=1#/hoc/toan');
    assert.ok(result.headers['Set-Cookie']);
    assert.match(result.headers['Set-Cookie'], /baoan_online_session=[a-zA-Z0-9_-]+/);
    assert.match(result.headers['Set-Cookie'], /HttpOnly/);
    assert.match(result.headers['Set-Cookie'], /SameSite=Lax/);

    // Verify session in auth_sessions table
    const sessions = store.db.prepare('SELECT * FROM auth_sessions').all();
    assert.ok(sessions.length > 0);
  }

  // 3. Ticket is one-time use only (BAO-08) -> second attempt fails with 400
  {
    const ssoUrl = new URL(`http://127.0.0.1/api/integration/safetime/v1/sso?ticket=${initialTicket}&to=hoc/toan`);
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/sso',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/sso', method: 'GET', url: ssoUrl });
    assert.equal(getResult().status, 400);
    assert.equal(getResult().json.error.code, 'invalid_ticket');
  }

  // 4. POST /student-refresh with invalid/mismatched refreshToken -> 401 or 403 (BAO-08)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-refresh',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { refreshToken: initialRefreshToken, studentId: student2Id } // wrong student
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-refresh', method: 'POST' });
    assert.equal(getResult().status, 403);
    assert.equal(getResult().json.error.code, 'token_mismatch');
  }

  // 5. POST /student-refresh with valid refreshToken -> 200 { ticket, refreshToken } with rotation (BAO-08)
  let secondTicket = '';
  let secondRefreshToken = '';
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-refresh',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { refreshToken: initialRefreshToken, studentId: student1Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-refresh', method: 'POST' });
    const result = getResult();
    assert.equal(result.status, 200);
    assert.ok(result.json.ticket);
    assert.ok(result.json.refreshToken);
    assert.notEqual(result.json.refreshToken, initialRefreshToken); // rotated
    secondTicket = result.json.ticket;
    secondRefreshToken = result.json.refreshToken;
  }

  // 6. Old refresh token was consumed (rotation) -> cannot be reused (BAO-08)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-refresh',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { refreshToken: initialRefreshToken, studentId: student1Id }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-refresh', method: 'POST' });
    assert.equal(getResult().status, 401);
    assert.equal(getResult().json.error.code, 'invalid_refresh_token');
  }

  // 7. New ticket works with /sso and sanitizes destination
  {
    const ssoUrl = new URL(`http://127.0.0.1/api/integration/safetime/v1/sso?ticket=${secondTicket}&to=evil.com/phishing`);
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/sso',
      method: 'GET'
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/sso', method: 'GET', url: ssoUrl, origin: 'http://127.0.0.1' });
    const result = getResult();
    assert.equal(result.status, 302);
    // Malicious destination safely redirected to ban-do
    assert.equal(result.headers.Location, '/?online=1#/ban-do');
  }

  // 8. POST /student-logout revokes refresh token (BAO-08)
  {
    const { req, res, getResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-logout',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { refreshToken: secondRefreshToken }
    });
    await router.handle(req, res, { path: '/api/integration/safetime/v1/student-logout', method: 'POST' });
    assert.equal(getResult().status, 204);

    // Refresh token is now revoked
    const { req: rReq, res: rRes, getResult: rResult } = mockRequestResponse({
      path: '/api/integration/safetime/v1/student-refresh',
      method: 'POST',
      headers: { authorization: `Bearer ${clientToken}`, 'content-type': 'application/json' },
      body: { refreshToken: secondRefreshToken, studentId: student1Id }
    });
    await router.handle(rReq, rRes, { path: '/api/integration/safetime/v1/student-refresh', method: 'POST' });
    assert.equal(rResult().status, 401);
  }
});

test('Task 3B.2, 3B.3, 3B.4 (BAO-01, BAO-05, BAO-06, BAO-07, BAO-08, BAO-09): Real HTTP Server loopback end-to-end integration', async (t) => {
  const server = createOnlineServer({ databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  t.after(() => {
    server.close();
    server.onlineClose();
  });

  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(server.onlineStore);

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

  // 5. HTTP POST /api/integration/safetime/v1/student-login (Task 3B.3)
  const resLogin = await fetch(`${origin}/api/integration/safetime/v1/student-login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'hocsinh_minh',
      password: 'MatKhauMinh123!',
      studentId: student1Id,
      remember: true
    })
  });
  assert.equal(resLogin.status, 200);
  const loginData = await resLogin.json();
  assert.equal(loginData.student.id, student1Id);
  assert.equal(loginData.student.displayName, 'Minh Hoàng');
  assert.ok(loginData.ticket);
  assert.ok(loginData.refreshToken);

  // 6. HTTP GET /api/integration/safetime/v1/sso (Task 3B.4)
  const resSso = await fetch(`${origin}/api/integration/safetime/v1/sso?ticket=${loginData.ticket}&to=hoc/tieng-viet`, {
    redirect: 'manual'
  });
  assert.equal(resSso.status, 302);
  assert.equal(resSso.headers.get('location'), '/?online=1#/hoc/tieng-viet');
  const cookieHeader = resSso.headers.get('set-cookie');
  assert.ok(cookieHeader);
  assert.match(cookieHeader, /baoan_online_session=/);

  // 7. HTTP POST /api/integration/safetime/v1/student-refresh (Task 3B.4)
  const resRefresh = await fetch(`${origin}/api/integration/safetime/v1/student-refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: loginData.refreshToken,
      studentId: student1Id
    })
  });
  assert.equal(resRefresh.status, 200);
  const refreshData = await resRefresh.json();
  assert.ok(refreshData.ticket);
  assert.ok(refreshData.refreshToken);
  assert.notEqual(refreshData.refreshToken, loginData.refreshToken);

  // 8. HTTP POST /api/integration/safetime/v1/student-logout (Task 3B.4)
  const resLogout = await fetch(`${origin}/api/integration/safetime/v1/student-logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: refreshData.refreshToken
    })
  });
  assert.equal(resLogout.status, 204);

  // 9. HTTP GET /api/integration/safetime/v1/status now paired: true
  const res4 = await fetch(`${origin}/api/integration/safetime/v1/status`);
  assert.equal(res4.status, 200);
  const data4 = await res4.json();
  assert.equal(data4.paired, true);

  // 10. HTTP DELETE /api/integration/safetime/v1/pair
  const res5 = await fetch(`${origin}/api/integration/safetime/v1/pair`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res5.status, 204);

  // 11. Token is now revoked
  const res6 = await fetch(`${origin}/api/integration/safetime/v1/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res6.status, 401);
  const err6 = await res6.json();
  assert.equal(err6.error.code, 'unauthorized');
});
