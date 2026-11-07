import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { OnlineStore } from '../server/online-store.mjs';
import { createOnlineServer } from '../server/online-server.mjs';
import { createSafeTimeIntegrationRouter, isLoopbackAddress, sanitizeDeepLink, normalizeIntegrationSubject } from '../server/safetime-integration.mjs';
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
    url: path,
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

test('Task 3B.5 (BAO-12): normalizeIntegrationSubject helper', () => {
  assert.equal(normalizeIntegrationSubject('toan'), 'toan');
  assert.equal(normalizeIntegrationSubject('Toán lớp 3'), 'toan');
  assert.equal(normalizeIntegrationSubject('math'), 'toan');
  assert.equal(normalizeIntegrationSubject('tieng-viet'), 'tieng-viet');
  assert.equal(normalizeIntegrationSubject('Tiếng Việt'), 'tieng-viet');
  assert.equal(normalizeIntegrationSubject('tieng-anh'), 'tieng-anh');
  assert.equal(normalizeIntegrationSubject('English'), 'tieng-anh');
  assert.equal(normalizeIntegrationSubject('tin-hoc'), 'tin-hoc');
  assert.equal(normalizeIntegrationSubject('Tin học'), 'tin-hoc');
  assert.equal(normalizeIntegrationSubject('Công nghệ'), 'tin-hoc');
  assert.equal(normalizeIntegrationSubject(null), 'toan');
});

test('Task 3B.5 (BAO-12, BAO-13): Store event recording and 30-day retention purge', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);

  // 1. Record 5 event types
  // Event 1: contest_submitted
  const contestEvt = store.recordIntegrationEvent(workspaceId, student1Id, 'contest_submitted', {
    sessionId: 'session_01',
    presetId: 'violympic-toan-3',
    title: 'Thi thử Violympic Toán 3',
    subject: 'toan',
    score: 280,
    maxScore: 300,
    correctCount: 28,
    totalItems: 30,
    startedAt: '2026-11-07T08:00:00.000Z',
    submittedAt: '2026-11-07T08:25:00.000Z',
    status: 'submitted'
  });
  assert.ok(contestEvt.id);
  assert.equal(contestEvt.eventType, 'contest_submitted');
  assert.equal(contestEvt.data.score, 280);

  // Event 2: week_completed
  const weekEvt = store.recordWeekCompleted(workspaceId, student1Id, 'Toán', 5);
  assert.ok(weekEvt.id);
  assert.equal(weekEvt.data.subject, 'toan');
  assert.equal(weekEvt.data.week, 5);

  // Event 3: badge_unlocked
  const badgeEvt = store.recordIntegrationEvent(workspaceId, student1Id, 'badge_unlocked', {
    badgeId: 'streak_7',
    title: 'Chăm chỉ 7 ngày'
  });
  assert.ok(badgeEvt.id);
  assert.equal(badgeEvt.data.badgeId, 'streak_7');

  // Event 4: daily_study
  const studyEvt = store.recordDailyStudy(workspaceId, student1Id, '2026-11-07', 25);
  assert.ok(studyEvt.id);
  assert.equal(studyEvt.data.minutes, 25);
  assert.equal(studyEvt.data.date, '2026-11-07');

  // Event 5: gift_delivered (NO stars per BAO-13!)
  const giftEvt = store.recordIntegrationEvent(workspaceId, student1Id, 'gift_delivered', {
    giftTitle: 'Hộp bút màu'
  });
  assert.ok(giftEvt.id);
  assert.equal(giftEvt.data.giftTitle, 'Hộp bút màu');
  assert.equal(giftEvt.data.stars, undefined); // Strictly NO stars

  // Record an event for student2Id
  store.recordDailyStudy(workspaceId, student2Id, '2026-11-07', 15);

  // 2. Test listIntegrationEvents pagination
  const page1 = store.listIntegrationEvents(workspaceId, { limit: 3 });
  assert.equal(page1.events.length, 3);
  assert.ok(page1.cursor > 0);

  const page2 = store.listIntegrationEvents(workspaceId, { afterCursor: page1.cursor, limit: 10 });
  assert.equal(page2.events.length, 3); // remaining 3 events
  assert.ok(page2.cursor > page1.cursor);

  // 3. Test allowedStudentIds filtering
  const student1Only = store.listIntegrationEvents(workspaceId, { allowedStudentIds: [student1Id] });
  assert.equal(student1Only.events.length, 5);
  assert.ok(student1Only.events.every(e => e.studentId === student1Id));

  const student2Only = store.listIntegrationEvents(workspaceId, { allowedStudentIds: [student2Id] });
  assert.equal(student2Only.events.length, 1);
  assert.equal(student2Only.events[0].studentId, student2Id);

  // 4. Test 30-day retention purge
  // Manually insert an event from 35 days ago
  const oldDate = new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString();
  store.db.prepare(`
    INSERT INTO integration_events(id, workspace_id, student_id, event_type, data_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('old_event_id', workspaceId, student1Id, 'daily_study', JSON.stringify({ date: '2026-10-01', minutes: 10 }), oldDate);

  // Purge should remove the 35-day-old event
  store.purgeOldIntegrationEvents(30);
  const checkOld = store.db.prepare('SELECT 1 FROM integration_events WHERE id = ?').get('old_event_id');
  assert.equal(checkOld, undefined);
});

test('Task 3B.5 (BAO-12): GET /api/integration/safetime/v1/events router and cursor pagination', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);
  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // 1. Create client with student1Id allowed
  const token = 'safetime_test_token_events_12345';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  store.createIntegrationClient(workspaceId, {
    tokenHash,
    deviceId: 'laptop-home-01',
    deviceName: 'Laptop Bàn Học',
    allowedStudentIds: [student1Id]
  });

  // Populate events for both students
  store.recordDailyStudy(workspaceId, student1Id, '2026-11-07', 20);
  store.recordWeekCompleted(workspaceId, student1Id, 'toan', 1);
  store.recordDailyStudy(workspaceId, student2Id, '2026-11-07', 30); // for student 2 (should be filtered out)
  store.recordIntegrationEvent(workspaceId, student1Id, 'badge_unlocked', { badgeId: 'speedy', title: 'Nhanh như chớp' });

  // 2. Unauthorized without token
  let mock = mockRequestResponse({ path: '/api/integration/safetime/v1/events', method: 'GET' });
  await router.handle(mock.req, mock.res);
  assert.equal(mock.getResult().status, 401);

  // 3. Query events with valid Bearer token
  mock = mockRequestResponse({
    path: '/api/integration/safetime/v1/events?limit=2',
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  await router.handle(mock.req, mock.res);
  const res1 = mock.getResult();
  assert.equal(res1.status, 200);
  assert.equal(res1.headers['X-Integration-Version'], '1');
  const data1 = res1.json;
  assert.equal(data1.events.length, 2);
  assert.ok(data1.cursor > 0);
  // All events belong to student1Id
  assert.ok(data1.events.every(e => e.studentId === student1Id));

  // 4. Query next page using cursor
  mock = mockRequestResponse({
    path: `/api/integration/safetime/v1/events?after=${data1.cursor}&limit=10`,
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  await router.handle(mock.req, mock.res);
  const res2 = mock.getResult();
  assert.equal(res2.status, 200);
  const data2 = res2.json;
  assert.equal(data2.events.length, 1);
  assert.equal(data2.events[0].type, 'badge_unlocked');
  assert.equal(data2.events[0].studentId, student1Id);

  // 5. Query when no more events exist
  mock = mockRequestResponse({
    path: `/api/integration/safetime/v1/events?after=${data2.cursor}&limit=10`,
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  await router.handle(mock.req, mock.res);
  const res3 = mock.getResult();
  assert.equal(res3.status, 200);
  const data3 = res3.json;
  assert.equal(data3.events.length, 0);
  assert.equal(data3.cursor, data2.cursor);
});

test('Task 3B.5 (BAO-12): Real HTTP Server loopback GET /events end-to-end', async () => {
  const server = createOnlineServer({ databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const store = server.onlineStore;
  const { workspaceId, student1Id } = await setupWorkspaceWithStudents(store);

  // Pair client
  const { code } = store.createIntegrationPairCode(workspaceId, [student1Id], 600);
  const pairRes = await fetch(`${origin}/api/integration/safetime/v1/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      deviceId: 'pc-real-http-events',
      deviceName: 'PC Kiểm Thử Events'
    })
  });
  assert.equal(pairRes.status, 200);
  const { token } = await pairRes.json();

  // Record an event
  store.recordIntegrationEvent(workspaceId, student1Id, 'contest_submitted', {
    sessionId: 'session_http_01',
    presetId: 'ioe-tieng-anh-3',
    title: 'IOE Tiếng Anh lớp 3',
    subject: 'tieng-anh',
    score: 190,
    maxScore: 200,
    correctCount: 19,
    totalItems: 20,
    startedAt: '2026-11-07T10:00:00Z',
    submittedAt: '2026-11-07T10:15:00Z',
    status: 'submitted'
  });

  // Call GET /api/integration/safetime/v1/events
  const eventsRes = await fetch(`${origin}/api/integration/safetime/v1/events?after=0&limit=10`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(eventsRes.status, 200);
  assert.equal(eventsRes.headers.get('x-integration-version'), '1');
  const body = await eventsRes.json();
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].type, 'contest_submitted');
  assert.equal(body.events[0].data.presetId, 'ioe-tieng-anh-3');
  assert.equal(body.events[0].data.score, 190);
  assert.ok(body.cursor > 0);

  server.close();
});

test('Task 3B.6 (BAO-11): store.getStudentTodayData aggregation', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id } = await setupWorkspaceWithStudents(store);

  const todayData = store.getStudentTodayData(workspaceId, student1Id);
  assert.ok(todayData);

  // 1. Student identity
  assert.equal(todayData.student.id, student1Id);
  assert.equal(todayData.student.displayName, 'Minh Hoàng');
  assert.equal(todayData.student.className, '3A');

  // 2. Date
  assert.match(todayData.date, /^\d{4}-\d{2}-\d{2}$/);

  // 3. Stars (read-only balance, with note)
  assert.equal(typeof todayData.stars.available, 'number');
  assert.equal(todayData.stars.note, 'Chỉ đổi vật phẩm trên Kệ quà');

  // 4. Streak
  assert.equal(typeof todayData.streakDays, 'number');

  // 5. Parent limits & screen time
  assert.equal(typeof todayData.baoAnLimit.maxMinutesPerDay, 'number');
  assert.equal(typeof todayData.baoAnLimit.usedMinutes, 'number');
  assert.equal(typeof todayData.baoAnLimit.allowedStartHour, 'number');
  assert.equal(typeof todayData.baoAnLimit.allowedEndHour, 'number');

  // 6. Subjects (4 standard subjects)
  assert.equal(todayData.subjects.length, 4);
  const keys = todayData.subjects.map(s => s.key);
  assert.deepEqual(keys, ['toan', 'tieng-viet', 'tieng-anh', 'tin-hoc']);
  for (const s of todayData.subjects) {
    assert.ok(s.label);
    assert.equal(typeof s.week, 'number');
    assert.equal(typeof s.packsPassed, 'number');
    assert.equal(typeof s.packsTotal, 'number');
    assert.ok(['todo', 'done', 'none', 'locked'].includes(s.state));
  }

  // 7. Daily missions
  assert.ok(Array.isArray(todayData.dailyMissions));
  for (const m of todayData.dailyMissions) {
    assert.ok(m.id);
    assert.ok(m.title);
    assert.equal(typeof m.done, 'boolean');
  }

  // 8. Contests
  assert.ok(Array.isArray(todayData.contests));
  for (const c of todayData.contests) {
    assert.ok(c.presetId);
    assert.ok(c.title);
    assert.ok(c.subject);
    assert.equal(typeof c.durationMinutes, 'number');
  }
});

test('Task 3B.6 (BAO-11, BAO-13): GET /api/integration/safetime/v1/students/{id}/today router endpoint', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);
  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // Create client paired ONLY for student1Id
  const token = 'safetime_test_token_today_12345';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  store.createIntegrationClient(workspaceId, {
    tokenHash,
    deviceId: 'tablet-today-01',
    deviceName: 'Tablet Hôm Nay',
    allowedStudentIds: [student1Id]
  });

  // 1. Missing Authorization header -> 401
  let mock = mockRequestResponse({
    path: `/api/integration/safetime/v1/students/${student1Id}/today`,
    method: 'GET'
  });
  await router.handle(mock.req, mock.res);
  assert.equal(mock.getResult().status, 401);

  // 2. Requesting student2Id (not allowed for this client) -> 403 student_not_allowed (BAO-13)
  mock = mockRequestResponse({
    path: `/api/integration/safetime/v1/students/${student2Id}/today`,
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  await router.handle(mock.req, mock.res);
  const resForbidden = mock.getResult();
  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.json.error.code, 'student_not_allowed');

  // 3. Requesting non-existent studentId -> 404
  mock = mockRequestResponse({
    path: '/api/integration/safetime/v1/students/non_existent_id/today',
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  await router.handle(mock.req, mock.res);
  assert.equal(mock.getResult().status, 403); // blocked because not in allowedStudentIds

  // 4. Requesting allowed student1Id -> 200 with today payload
  mock = mockRequestResponse({
    path: `/api/integration/safetime/v1/students/${student1Id}/today`,
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  await router.handle(mock.req, mock.res);
  const resSuccess = mock.getResult();
  assert.equal(resSuccess.status, 200);
  assert.equal(resSuccess.headers['X-Integration-Version'], '1');
  const payload = resSuccess.json;
  assert.equal(payload.student.id, student1Id);
  assert.equal(payload.student.displayName, 'Minh Hoàng');
  assert.equal(payload.student.className, '3A');
  assert.ok(payload.date);
  assert.equal(payload.stars.note, 'Chỉ đổi vật phẩm trên Kệ quà');
  assert.equal(payload.subjects.length, 4);
  assert.ok(Array.isArray(payload.dailyMissions));
  assert.ok(Array.isArray(payload.contests));
});

test('Task 3B.6 (BAO-11): Real HTTP Server loopback GET /students/{id}/today end-to-end', async () => {
  const server = createOnlineServer({ databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const store = server.onlineStore;
  const { workspaceId, student1Id } = await setupWorkspaceWithStudents(store);

  // Pair client
  const { code } = store.createIntegrationPairCode(workspaceId, [student1Id], 600);
  const pairRes = await fetch(`${origin}/api/integration/safetime/v1/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      deviceId: 'pc-real-http-today',
      deviceName: 'PC Kiểm Thử Today'
    })
  });
  assert.equal(pairRes.status, 200);
  const { token } = await pairRes.json();

  // Call GET /api/integration/safetime/v1/students/{id}/today
  const todayRes = await fetch(`${origin}/api/integration/safetime/v1/students/${student1Id}/today`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(todayRes.status, 200);
  assert.equal(todayRes.headers.get('x-integration-version'), '1');
  const body = await todayRes.json();
  assert.equal(body.student.id, student1Id);
  assert.equal(body.student.displayName, 'Minh Hoàng');
  assert.equal(body.stars.note, 'Chỉ đổi vật phẩm trên Kệ quà');
  assert.equal(body.subjects.length, 4);

  server.close();
});


// =============================================================================
// Task 3B.8 Tests: Parent Portal SafeTime Management & Audit Logging (BAO-02, BAO-03, BAO-16)
// =============================================================================

test('Task 3B.8 (BAO-16): Audit logging for pairing, revocation and failed logins', async () => {
  const store = new OnlineStore(':memory:');
  const db = store.db;
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);

  const router = createSafeTimeIntegrationRouter({
    store,
    db,
    authenticateUserCredentials: async ({ rawUsername, rawPassword }) => {
      if (rawUsername === 'hocsinh_minh' && rawPassword === 'MatKhauMinh123!') {
        return { id: 'u1', role: 'student', student_id: student1Id };
      }
      throw { status: 401, message: 'Sai mật khẩu' };
    }
  });

  // 1. Audit on pair code creation
  const parentAuth = { workspaceId, id: 'parent-u1', role: 'parent' };
  const pairCodeResult = store.parentCreatePairCode(parentAuth, [student1Id]);
  assert.equal(pairCodeResult.code.length, 8);
  const auditPairCode = db.prepare("SELECT * FROM audit WHERE action = 'integration.pair_code_create'").get();
  assert.ok(auditPairCode);
  const auditPairCodeData = JSON.parse(auditPairCode.target_id);
  assert.equal(auditPairCodeData.code, pairCodeResult.code);
  assert.deepEqual(auditPairCodeData.allowedStudentIds, [student1Id]);

  // 2. Audit on successful pair
  const mockPairReq = {
    method: 'POST',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json' },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        code: pairCodeResult.code,
        deviceId: 'mac-audit-01',
        deviceName: 'MacBook Của Con'
      }));
    }
  };
  const mockPairRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; }
  };
  await router.handle(mockPairReq, mockPairRes, { path: '/api/integration/safetime/v1/pair' });
  assert.equal(mockPairRes.statusCode, 200);
  const { token } = JSON.parse(mockPairRes.body);

  const auditPair = db.prepare("SELECT * FROM audit WHERE action = 'integration.pair'").get();
  assert.ok(auditPair);
  const auditPairData = JSON.parse(auditPair.target_id);
  assert.equal(auditPairData.deviceId, 'mac-audit-01');
  assert.equal(auditPairData.deviceName, 'MacBook Của Con');

  // 3. Audit on student login failure: wrong student
  const mockLoginWrongStudent = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'hocsinh_minh',
        password: 'MatKhauMinh123!',
        studentId: student2Id // student2Id not allowed on this device
      }));
    }
  };
  const mockLoginRes1 = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; }
  };
  await router.handle(mockLoginWrongStudent, mockLoginRes1, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(mockLoginRes1.statusCode, 403);

  const auditLoginFail1 = db.prepare("SELECT * FROM audit WHERE action = 'integration.login_failed' AND target_id LIKE '%student_not_allowed%'").get();
  assert.ok(auditLoginFail1);

  // 4. Audit on student login failure: invalid credentials
  const mockLoginBadPass = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'hocsinh_minh',
        password: 'SaiPasswordHoanToan!',
        studentId: student1Id
      }));
    }
  };
  const mockLoginRes2 = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; }
  };
  await router.handle(mockLoginBadPass, mockLoginRes2, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(mockLoginRes2.statusCode, 401);

  const auditLoginFail2 = db.prepare("SELECT * FROM audit WHERE action = 'integration.login_failed' AND target_id LIKE '%invalid_credentials%'").get();
  assert.ok(auditLoginFail2);

  // 5. Audit on client revocation via DELETE /pair
  const mockDeletePair = {
    method: 'DELETE',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { authorization: `Bearer ${token}` }
  };
  const mockDeleteRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end() {}
  };
  await router.handle(mockDeletePair, mockDeleteRes, { path: '/api/integration/safetime/v1/pair', method: 'DELETE' });
  assert.equal(mockDeleteRes.statusCode, 204);

  const auditRevoke = db.prepare("SELECT * FROM audit WHERE action = 'integration.client_revoke' AND target_id LIKE '%client%'").get();
  assert.ok(auditRevoke);

  store.close();
});

test('Task 3B.8 (BAO-02, BAO-03, BAO-01): Parent store methods for status, pair code, client revoke and toggle', async () => {
  const store = new OnlineStore(':memory:');
  const db = store.db;
  const { workspaceId, student1Id, student2Id } = await setupWorkspaceWithStudents(store);
  const adminAuth = { workspaceId, id: 'admin-01', role: 'admin' };

  // 1. Initial status: integration disabled by default (BAO-01)
  assert.equal(store.isIntegrationEnabled(workspaceId), false);
  const initialStatus = store.parentSafetimeStatus(adminAuth);
  assert.equal(initialStatus.enabled, false);
  assert.equal(initialStatus.paired, false);
  assert.equal(initialStatus.clients.length, 0);
  assert.equal(initialStatus.activePairCode, null);
  assert.equal(initialStatus.availableStudents.length, 2);

  // 2. Create pair code: enables integration and returns 8-char code (BAO-01, BAO-02)
  const pairCodeRes = store.parentCreatePairCode(adminAuth, [student1Id, student2Id]);
  assert.equal(pairCodeRes.code.length, 8);
  assert.equal(store.isIntegrationEnabled(workspaceId), true);

  const statusAfterCode = store.parentSafetimeStatus(adminAuth);
  assert.equal(statusAfterCode.enabled, true);
  assert.ok(statusAfterCode.activePairCode);
  assert.equal(statusAfterCode.activePairCode.code, pairCodeRes.code);
  assert.deepEqual(statusAfterCode.activePairCode.allowedStudentIds, [student1Id, student2Id]);

  // 3. Client pairs and appears in clients list (BAO-03)
  const client = store.createIntegrationClient(workspaceId, {
    tokenHash: 'dummy-hash-for-parent-test',
    deviceId: 'laptop-dell-01',
    deviceName: 'Laptop Dell Inspiron',
    allowedStudentIds: [student1Id]
  });

  const statusWithClient = store.parentSafetimeStatus(adminAuth);
  assert.equal(statusWithClient.paired, true);
  assert.equal(statusWithClient.clients.length, 1);
  assert.equal(statusWithClient.clients[0].deviceName, 'Laptop Dell Inspiron');
  assert.equal(statusWithClient.clients[0].revokedAt, null);

  // 4. Revoke client from Parent Portal (BAO-03, BAO-16)
  const revokeRes = store.parentRevokeClient(adminAuth, client.id);
  assert.equal(revokeRes.success, true);

  const statusAfterRevoke = store.parentSafetimeStatus(adminAuth);
  assert.equal(statusAfterRevoke.paired, false);
  assert.ok(statusAfterRevoke.clients[0].revokedAt);

  const auditRevokeParent = db.prepare("SELECT * FROM audit WHERE action = 'integration.client_revoke' AND target_id LIKE '%parent%'").get();
  assert.ok(auditRevokeParent);

  // 5. Toggle integration
  store.parentToggleIntegration(adminAuth, false);
  assert.equal(store.isIntegrationEnabled(workspaceId), false);
  const statusAfterToggleOff = store.parentSafetimeStatus(adminAuth);
  assert.equal(statusAfterToggleOff.enabled, false);

  store.parentToggleIntegration(adminAuth, true);
  assert.equal(store.isIntegrationEnabled(workspaceId), true);

  store.close();
});

test('Task 3B.8: Real HTTP loopback server testing for /parent/safetime/* endpoints', async () => {
  const server = createOnlineServer({ databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const store = server.onlineStore;
  const { workspaceId, student1Id } = await setupWorkspaceWithStudents(store);

  // Let's create an admin user and login
  const adminUserId = randomUUID();
  const adminHash = await makePasswordHash('MatKhauAdmin123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(adminUserId, workspaceId, 'quantri_test', adminHash, 'admin', new Date().toISOString());

  const loginRes = await fetch(`${origin}/api/online/login`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username: 'quantri_test', password: 'MatKhauAdmin123!' })
  });
  assert.equal(loginRes.status, 200);
  const cookieHeader = loginRes.headers.get('set-cookie');
  const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  const loginData = await loginRes.json();
  const csrf = loginData.csrfToken;

  // 1. GET /api/online/parent/safetime/status
  const statusRes = await fetch(`${origin}/api/online/parent/safetime/status`, {
    headers: {
      Cookie: sessionCookie,
      'X-CSRF-Token': csrf
    }
  });
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.enabled, false);
  assert.equal(statusJson.paired, false);

  // 2. POST /api/online/parent/safetime/pair-code
  const pairCodeRes = await fetch(`${origin}/api/online/parent/safetime/pair-code`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Cookie: sessionCookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf
    },
    body: JSON.stringify({ studentIds: [student1Id] })
  });
  assert.equal(pairCodeRes.status, 200);
  const pairCodeJson = await pairCodeRes.json();
  assert.equal(pairCodeJson.code.length, 8);
  assert.deepEqual(pairCodeJson.allowedStudentIds, [student1Id]);

  // 3. GET status again to see active pair code
  const statusRes2 = await fetch(`${origin}/api/online/parent/safetime/status`, {
    headers: {
      Cookie: sessionCookie,
      'X-CSRF-Token': csrf
    }
  });
  assert.equal(statusRes2.status, 200);
  const statusJson2 = await statusRes2.json();
  assert.equal(statusJson2.enabled, true);
  assert.equal(statusJson2.activePairCode.code, pairCodeJson.code);

  server.close();
});
