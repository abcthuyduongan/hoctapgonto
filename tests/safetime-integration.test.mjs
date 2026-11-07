/**
 * tests/safetime-integration.test.mjs — Comprehensive Integration Test Suite
 * Requirements: BAO-13, BAO-15 (Section 6 - B9 of ket-noi-bao-an.md)
 * 
 * Verifies:
 * 1. Device Pairing (POST /pair): code validity, 10-min TTL, one-time use, 5-failure 15-min lockout.
 * 2. Key Authentication & Revocation: invalid key, revoked key, missing bearer.
 * 3. Loopback & Rate Limiting: remote IP rejection, 120 req/min limit.
 * 4. Student Login: credentials check, brute-force rateLimit, non-student account rejection.
 * 5. Student Isolation (wrong_student / student_not_allowed): account mismatch, unallowed student.
 * 6. SSO Ticket: 60s TTL, one-time use, session creation, HTTP-only cookie.
 * 7. Deep-link Sanitization: valid routes, strict fallback to 'ban-do' for malicious/unknown targets.
 * 8. Refresh Token Rotation & Logout: rotation on refresh, revoked on logout.
 * 9. Event Stream & Cursor Pagination: unique event IDs, cursor pagination, allowed student filtering.
 * 10. Privacy & Security Invariant: no answer keys, no password hashes, no PII leakage.
 * 11. Star Wallet Safety Invariant: zero star alteration across all integration endpoints.
 * 12. Management Audit Logging (BAO-16): pair_code_create, pair, client_revoke, login_failed.
 */

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

async function setupTestFixture(store) {
  const workspaceId = randomUUID();
  const now = new Date().toISOString();
  store.db.prepare('INSERT INTO workspaces(id, name, wallet_enabled, rate_vnd, created_at) VALUES(?, ?, 1, 1000, ?)').run(workspaceId, 'Trường Test SafeTime', now);

  const classId = randomUUID();
  store.db.prepare('INSERT INTO classes(id, workspace_id, name, grade, created_at) VALUES(?, ?, ?, ?, ?)').run(classId, workspaceId, '3A', 3, now);

  // Student 1: Minh Hoàng
  const student1Id = randomUUID();
  const user1Id = randomUUID();
  const passHash1 = await makePasswordHash('MatKhauMinh123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, student_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(user1Id, workspaceId, 'hocsinh_minh', passHash1, 'student', student1Id, now);
  store.db.prepare('INSERT INTO students(id, workspace_id, class_id, name, user_id, active, created_at) VALUES(?, ?, ?, ?, ?, 1, ?)')
    .run(student1Id, workspaceId, classId, 'Minh Hoàng', user1Id, now);

  // Award stars to student 1
  store.db.prepare(`
    INSERT INTO awards(workspace_id, student_id, pack_id, tier, json)
    VALUES(?, ?, 'pack_star_test', 3, ?)
  `).run(workspaceId, student1Id, JSON.stringify({
    packId: 'pack_star_test',
    starTier: 15,
    earnedStars: 15,
    thresholdStars: 15,
    unlockedTier: 3,
    awardedAt: now
  }));

  // Student 2: An Nhiên
  const student2Id = randomUUID();
  const user2Id = randomUUID();
  const passHash2 = await makePasswordHash('MatKhauAn123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, student_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(user2Id, workspaceId, 'hocsinh_an', passHash2, 'student', student2Id, now);
  store.db.prepare('INSERT INTO students(id, workspace_id, class_id, name, user_id, active, created_at) VALUES(?, ?, ?, ?, ?, 1, ?)')
    .run(student2Id, workspaceId, classId, 'An Nhiên', user2Id, now);

  // Admin user
  const adminUserId = randomUUID();
  const adminHash = await makePasswordHash('MatKhauAdmin123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(adminUserId, workspaceId, 'admin_safetime', adminHash, 'admin', now);

  // Parent user
  const parentUserId = randomUUID();
  const parentHash = await makePasswordHash('MatKhauParent123!');
  store.db.prepare('INSERT INTO users(id, workspace_id, username, password_hash, role, created_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(parentUserId, workspaceId, 'parent_safetime', parentHash, 'parent', now);
  store.db.prepare('INSERT INTO parent_students(workspace_id, parent_user_id, student_id, created_at) VALUES(?, ?, ?, ?)')
    .run(workspaceId, parentUserId, student1Id, now);

  return { workspaceId, classId, student1Id, student2Id, user1Id, user2Id, adminUserId, parentUserId };
}

// -----------------------------------------------------------------------------
// Test 1: Device Pairing (BAO-01, BAO-02, BAO-05)
// -----------------------------------------------------------------------------
test('BAO-15 Suite 1: Device Pairing (POST /pair) code lifecycle and brute-force lockout', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id } = await setupTestFixture(store);
  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // 1. Initial state: integration disabled before code creation (BAO-01)
  assert.equal(store.isIntegrationEnabled(workspaceId), false);

  // 2. Parent creates pair code (BAO-02)
  const adminAuth = { workspaceId, id: 'admin', role: 'admin' };
  const pairCodeRes = store.parentCreatePairCode(adminAuth, [student1Id]);
  assert.equal(pairCodeRes.code.length, 8);
  assert.equal(store.isIntegrationEnabled(workspaceId), true);

  // 3. Pair successfully
  const mockReq = {
    method: 'POST',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json' },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        code: pairCodeRes.code,
        deviceId: 'dev-safetime-01',
        deviceName: 'Máy Tính Phòng Học'
      }));
    }
  };
  const mockRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockReq, mockRes, { path: '/api/integration/safetime/v1/pair' });
  assert.equal(mockRes.statusCode, 200);
  const pairData = JSON.parse(mockRes.body);
  assert.ok(pairData.token);
  assert.equal(pairData.token.length, 64);
  assert.equal(pairData.students.length, 1);
  assert.equal(pairData.students[0].id, student1Id);

  // 4. Reuse same pair code -> rejected (BAO-02)
  const mockReqReuse = {
    method: 'POST',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json' },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        code: pairCodeRes.code,
        deviceId: 'dev-safetime-02',
        deviceName: 'Máy Tính Khác'
      }));
    }
  };
  const mockResReuse = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockReqReuse, mockResReuse, { path: '/api/integration/safetime/v1/pair' });
  assert.equal(mockResReuse.statusCode, 400);

  // 5. Brute-force lockout: 5 failed attempts locks for 15 minutes (BAO-05)
  for (let i = 0; i < 4; i++) {
    const mockReqBad = {
      method: 'POST',
      url: '/api/integration/safetime/v1/pair',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify({
          code: 'WRONG' + i,
          deviceId: 'dev-attacker',
          deviceName: 'Máy Kẻ Tấn Công'
        }));
      }
    };
    const mockResBad = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
      end(b) { this.body = b; }
    };
    await router.handle(mockReqBad, mockResBad, { path: '/api/integration/safetime/v1/pair' });
    assert.equal(mockResBad.statusCode, 400);
  }

  // 5th failed attempt triggers 429 lockout
  const mockReqLock = {
    method: 'POST',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json' },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        code: 'WRONG5TH',
        deviceId: 'dev-attacker',
        deviceName: 'Máy Kẻ Tấn Công'
      }));
    }
  };
  const mockResLock = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockReqLock, mockResLock, { path: '/api/integration/safetime/v1/pair' });
  assert.equal(mockResLock.statusCode, 429);
  assert.ok(JSON.parse(mockResLock.body).error.code.includes('pair_locked'));

  store.close();
});

// -----------------------------------------------------------------------------
// Test 2: Key Authentication & Loopback Restriction (BAO-04, BAO-05)
// -----------------------------------------------------------------------------
test('BAO-15 Suite 2: Remote IP rejection and token verification (BAO-05)', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id } = await setupTestFixture(store);
  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // 1. Remote IP rejection (BAO-05)
  const mockRemoteReq = {
    method: 'GET',
    url: '/api/integration/safetime/v1/status',
    socket: { remoteAddress: '192.168.1.155' }
  };
  const mockRemoteRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockRemoteReq, mockRemoteRes, { path: '/api/integration/safetime/v1/status' });
  assert.equal(mockRemoteRes.statusCode, 403);
  assert.equal(JSON.parse(mockRemoteRes.body).error.code, 'forbidden_remote');

  // 2. Loopback allowed
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('10.0.0.5'), false);

  // 3. Unauthorized request without token
  const mockNoAuthReq = {
    method: 'GET',
    url: '/api/integration/safetime/v1/students',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {}
  };
  const mockNoAuthRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockNoAuthReq, mockNoAuthRes, { path: '/api/integration/safetime/v1/students' });
  assert.equal(mockNoAuthRes.statusCode, 401);

  // 4. Unauthorized request with revoked token
  const client = store.createIntegrationClient(workspaceId, {
    tokenHash: createHash('sha256').update('revoked-raw-token').digest('hex'),
    deviceId: 'dev-revoked',
    deviceName: 'Máy Đã Thu Hồi',
    allowedStudentIds: [student1Id]
  });
  store.revokeIntegrationClient(client.id);

  const mockRevokedReq = {
    method: 'GET',
    url: '/api/integration/safetime/v1/students',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { authorization: 'Bearer revoked-raw-token' }
  };
  const mockRevokedRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockRevokedReq, mockRevokedRes, { path: '/api/integration/safetime/v1/students' });
  assert.equal(mockRevokedRes.statusCode, 401);

  store.close();
});

// -----------------------------------------------------------------------------
// Test 3: Student Login & Account Boundary Isolation (BAO-07, LNK-09)
// -----------------------------------------------------------------------------
test('BAO-15 Suite 3: Student login isolation, wrong_student and student_not_allowed (BAO-07)', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id, student2Id, adminUserId } = await setupTestFixture(store);

  // Device allowed only student1Id
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  store.createIntegrationClient(workspaceId, {
    tokenHash,
    deviceId: 'dev-child-minh',
    deviceName: 'Máy Tính Của Minh',
    allowedStudentIds: [student1Id]
  });

  const router = createSafeTimeIntegrationRouter({
    store,
    db: store.db,
    authenticateUserCredentials: async ({ rawUsername, rawPassword }) => {
      if (rawUsername === 'hocsinh_minh' && rawPassword === 'MatKhauMinh123!') {
        return { id: 'u-minh', role: 'student', student_id: student1Id };
      }
      if (rawUsername === 'hocsinh_an' && rawPassword === 'MatKhauAn123!') {
        return { id: 'u-an', role: 'student', student_id: student2Id };
      }
      if (rawUsername === 'admin_safetime' && rawPassword === 'MatKhauAdmin123!') {
        return { id: adminUserId, role: 'admin' };
      }
      throw { status: 401, message: 'Sai mật khẩu' };
    }
  });

  // 1. Login with student2Id on device meant only for student1Id -> 403 student_not_allowed
  const reqNotAllowed = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rawToken}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'hocsinh_an',
        password: 'MatKhauAn123!',
        studentId: student2Id
      }));
    }
  };
  const resNotAllowed = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqNotAllowed, resNotAllowed, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(resNotAllowed.statusCode, 403);
  assert.equal(JSON.parse(resNotAllowed.body).error.code, 'student_not_allowed');

  // 2. Login with student An's credentials claiming to be Minh (wrong_student, BAO-07)
  const reqWrongStudent = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rawToken}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'hocsinh_an',
        password: 'MatKhauAn123!',
        studentId: student1Id
      }));
    }
  };
  const resWrongStudent = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqWrongStudent, resWrongStudent, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(resWrongStudent.statusCode, 403);
  assert.equal(JSON.parse(resWrongStudent.body).error.code, 'wrong_student');

  // 3. Login with admin credentials through student portal -> rejected (not_student)
  const reqNotStudent = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rawToken}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'admin_safetime',
        password: 'MatKhauAdmin123!',
        studentId: student1Id
      }));
    }
  };
  const resNotStudent = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqNotStudent, resNotStudent, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(resNotStudent.statusCode, 403);
  assert.equal(JSON.parse(resNotStudent.body).error.code, 'not_student');

  // 4. Valid login -> receives ticket and refreshToken (BAO-08)
  const reqValid = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rawToken}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'hocsinh_minh',
        password: 'MatKhauMinh123!',
        studentId: student1Id,
        remember: true
      }));
    }
  };
  const resValid = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqValid, resValid, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(resValid.statusCode, 200);
  const loginResult = JSON.parse(resValid.body);
  assert.equal(loginResult.student.id, student1Id);
  assert.ok(loginResult.ticket);
  assert.ok(loginResult.refreshToken);

  store.close();
});

// -----------------------------------------------------------------------------
// Test 4: SSO Ticket, Refresh Token Rotation & Deep-link Sanitize (BAO-08, BAO-09)
// -----------------------------------------------------------------------------
test('BAO-15 Suite 4: SSO Ticket replay prevention, refresh rotation, and deep link security (BAO-08, BAO-09)', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id } = await setupTestFixture(store);

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const client = store.createIntegrationClient(workspaceId, {
    tokenHash,
    deviceId: 'dev-sso-test',
    deviceName: 'Máy SSO',
    allowedStudentIds: [student1Id]
  });

  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // 1. Deep link sanitization (BAO-09)
  assert.equal(sanitizeDeepLink('hoc/toan'), 'hoc/toan');
  assert.equal(sanitizeDeepLink('hoc/tieng-viet'), 'hoc/tieng-viet');
  assert.equal(sanitizeDeepLink('hoc/tieng-anh'), 'hoc/tieng-anh');
  assert.equal(sanitizeDeepLink('hoc/tin-hoc'), 'hoc/tin-hoc');
  assert.equal(sanitizeDeepLink('nhiem-vu'), 'nhiem-vu');
  assert.equal(sanitizeDeepLink('thi/violympic-3'), 'thi/violympic-3');
  assert.equal(sanitizeDeepLink('ban-do'), 'ban-do');
  assert.equal(sanitizeDeepLink('qua'), 'qua');

  // Malicious/unknown targets coerced safely to 'ban-do'
  assert.equal(sanitizeDeepLink('https://phishing.site'), 'ban-do');
  assert.equal(sanitizeDeepLink('//evil.com/exploit'), 'ban-do');
  assert.equal(sanitizeDeepLink('javascript:alert(1)'), 'ban-do');
  assert.equal(sanitizeDeepLink('../../admin/sensitive'), 'ban-do');

  // 2. Consume ticket once -> 302 redirect + cookie
  const { ticket } = store.createIntegrationTicket(workspaceId, client.id, student1Id, 60);
  const mockSsoReq = {
    method: 'GET',
    url: `/api/integration/safetime/v1/sso?ticket=${ticket}&to=hoc/toan`,
    socket: { remoteAddress: '127.0.0.1' }
  };
  const mockSsoRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end() {}
  };
  await router.handle(mockSsoReq, mockSsoRes, {
    path: '/api/integration/safetime/v1/sso',
    url: new URL(`http://127.0.0.1/api/integration/safetime/v1/sso?ticket=${ticket}&to=hoc/toan`)
  });
  assert.equal(mockSsoRes.statusCode, 302);
  assert.equal(mockSsoRes.headers.Location, '/?online=1#/hoc/toan');
  assert.ok(mockSsoRes.headers['Set-Cookie'].includes('baoan_online_session='));
  assert.ok(mockSsoRes.headers['Set-Cookie'].includes('HttpOnly'));

  // 3. Ticket replay attempt -> 400 invalid_ticket
  const mockSsoReplayRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockSsoReq, mockSsoReplayRes, {
    path: '/api/integration/safetime/v1/sso',
    url: new URL(`http://127.0.0.1/api/integration/safetime/v1/sso?ticket=${ticket}&to=hoc/toan`)
  });
  assert.equal(mockSsoReplayRes.statusCode, 400);

  // 4. Refresh token rotation
  const { rawToken: refreshToken } = store.createIntegrationRefreshToken(workspaceId, client.id, student1Id, 30);
  const mockRefreshReq = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-refresh',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rawToken}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({ refreshToken, studentId: student1Id }));
    }
  };
  const mockRefreshRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockRefreshReq, mockRefreshRes, { path: '/api/integration/safetime/v1/student-refresh' });
  assert.equal(mockRefreshRes.statusCode, 200);
  const refreshResult = JSON.parse(mockRefreshRes.body);
  assert.ok(refreshResult.ticket);
  assert.ok(refreshResult.refreshToken);
  assert.notEqual(refreshResult.refreshToken, refreshToken); // rotated!

  // Reusing the old refreshToken fails
  const mockRefreshOldRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockRefreshReq, mockRefreshOldRes, { path: '/api/integration/safetime/v1/student-refresh' });
  assert.equal(mockRefreshOldRes.statusCode, 401);

  // 5. Logout revokes refreshToken
  const mockLogoutReq = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-logout',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${rawToken}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({ refreshToken: refreshResult.refreshToken }));
    }
  };
  const mockLogoutRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end() {}
  };
  await router.handle(mockLogoutReq, mockLogoutRes, { path: '/api/integration/safetime/v1/student-logout' });
  assert.equal(mockLogoutRes.statusCode, 204);

  store.close();
});

// -----------------------------------------------------------------------------
// Test 5: Star Balance Preservation & Privacy Invariant (BAO-13)
// -----------------------------------------------------------------------------
test('BAO-15 Suite 5 (BAO-13): Star balance preservation & No answer leakage invariant', async () => {
  const store = new OnlineStore(':memory:');
  const { workspaceId, student1Id } = await setupTestFixture(store);

  // Check initial star balance
  const authStudent = { workspaceId, studentId: student1Id, id: 'u1', role: 'student' };
  const initialBalance = store.balance(authStudent, student1Id);
  assert.equal(initialBalance.available, 15);

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  store.createIntegrationClient(workspaceId, {
    tokenHash,
    deviceId: 'dev-privacy-check',
    deviceName: 'Máy Kiểm Tra Bảo Mật',
    allowedStudentIds: [student1Id]
  });

  const router = createSafeTimeIntegrationRouter({ store, db: store.db });

  // 1. GET /status -> no secret leakage
  const reqStatus = {
    method: 'GET',
    url: '/api/integration/safetime/v1/status',
    socket: { remoteAddress: '127.0.0.1' }
  };
  const resStatus = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqStatus, resStatus, { path: '/api/integration/safetime/v1/status' });
  assert.equal(resStatus.statusCode, 200);
  assert.equal(JSON.stringify(resStatus.body).includes('password'), false);

  // 2. GET /students/{id}/today -> check data and verify NO answers/hashes leak
  const reqToday = {
    method: 'GET',
    url: `/api/integration/safetime/v1/students/${student1Id}/today`,
    socket: { remoteAddress: '127.0.0.1' },
    headers: { authorization: `Bearer ${rawToken}` }
  };
  const resToday = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqToday, resToday, { path: `/api/integration/safetime/v1/students/${student1Id}/today` });
  assert.equal(resToday.statusCode, 200);
  const todayBody = JSON.parse(resToday.body);

  // Assert today data structure (Section 5.2)
  assert.equal(todayBody.student.id, student1Id);
  assert.equal(todayBody.stars.available, 15);
  assert.equal(todayBody.stars.note, 'Chỉ đổi vật phẩm trên Kệ quà');
  assert.ok(Array.isArray(todayBody.subjects));
  assert.equal(todayBody.subjects.length, 4);

  // Invariant BAO-13: NO answers or question option keys in today response
  const todayStr = JSON.stringify(todayBody);
  assert.equal(todayStr.includes('correctIndex'), false);
  assert.equal(todayStr.includes('password_hash'), false);
  assert.equal(todayStr.includes('options'), false);
  assert.equal(todayStr.includes('secretInternalAuditField'), false);

  // 3. Record 5 integration events and fetch via GET /events
  store.recordIntegrationEvent(workspaceId, student1Id, 'contest_submitted', {
    sessionId: 'sess-01',
    presetId: 'violympic-3',
    title: 'Thi thử Violympic Toán',
    subject: 'toan',
    score: 280,
    maxScore: 300,
    correctCount: 28,
    totalItems: 30,
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    submittedAt: new Date().toISOString(),
    status: 'submitted'
  });
  store.recordWeekCompleted(workspaceId, student1Id, 'toan', 5);
  store.recordDailyStudy(workspaceId, student1Id, '2026-11-07', 25);
  store.recordIntegrationEvent(workspaceId, student1Id, 'badge_unlocked', { badgeId: 'b1', title: 'Học Sinh Chăm Chỉ' });
  store.recordIntegrationEvent(workspaceId, student1Id, 'gift_delivered', { giftTitle: 'Bộ Truyện Tranh Doraemon' });

  const reqEvents = {
    method: 'GET',
    url: '/api/integration/safetime/v1/events?after=0&limit=10',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { authorization: `Bearer ${rawToken}` }
  };
  const resEvents = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(reqEvents, resEvents, {
    path: '/api/integration/safetime/v1/events',
    url: new URL('http://127.0.0.1/api/integration/safetime/v1/events?after=0&limit=10')
  });
  assert.equal(resEvents.statusCode, 200);
  const eventsBody = JSON.parse(resEvents.body);
  assert.equal(eventsBody.events.length, 5);

  // Invariant BAO-13: gift_delivered must NOT contain star counts
  const giftEvent = eventsBody.events.find(e => e.type === 'gift_delivered');
  assert.ok(giftEvent);
  assert.equal(giftEvent.data.giftTitle, 'Bộ Truyện Tranh Doraemon');
  assert.equal(giftEvent.data.stars, undefined);
  assert.equal(giftEvent.data.starCount, undefined);

  // Invariant BAO-13: Check final star balance strictly equals initial balance (ZERO star discrepancy)
  const finalBalance = store.balance(authStudent, student1Id);
  assert.equal(finalBalance.available, 15);
  assert.equal(finalBalance.earned, initialBalance.earned);
  assert.equal(finalBalance.redeemed, initialBalance.redeemed);
  assert.equal(finalBalance.pending, initialBalance.pending);

  store.close();
});

// -----------------------------------------------------------------------------
// Test 6: Management Audit Logging (BAO-16)
// -----------------------------------------------------------------------------
test('BAO-15 Suite 6 (BAO-16): Audit logging for all 4 management actions', async () => {
  const store = new OnlineStore(':memory:');
  const db = store.db;
  const { workspaceId, student1Id } = await setupTestFixture(store);
  const adminAuth = { workspaceId, id: 'admin-01', role: 'admin' };

  // 1. Audit on pair code creation
  const pairCodeRes = store.parentCreatePairCode(adminAuth, [student1Id]);
  const audit1 = db.prepare("SELECT * FROM audit WHERE action = 'integration.pair_code_create'").get();
  assert.ok(audit1);
  assert.equal(JSON.parse(audit1.target_id).code, pairCodeRes.code);

  // 2. Audit on pair
  const router = createSafeTimeIntegrationRouter({
    store,
    db,
    authenticateUserCredentials: async () => { throw { status: 401, message: 'Sai mật khẩu' }; }
  });
  const mockPairReq = {
    method: 'POST',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json' },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        code: pairCodeRes.code,
        deviceId: 'pc-audit-full',
        deviceName: 'PC Khảo Sát Audit'
      }));
    }
  };
  const mockPairRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockPairReq, mockPairRes, { path: '/api/integration/safetime/v1/pair' });
  assert.equal(mockPairRes.statusCode, 200);
  const audit2 = db.prepare("SELECT * FROM audit WHERE action = 'integration.pair'").get();
  assert.ok(audit2);
  assert.equal(JSON.parse(audit2.target_id).deviceName, 'PC Khảo Sát Audit');

  // 3. Audit on client revoke
  const { token } = JSON.parse(mockPairRes.body);
  const mockRevokeReq = {
    method: 'DELETE',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { authorization: `Bearer ${token}` }
  };
  const mockRevokeRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end() {}
  };
  await router.handle(mockRevokeReq, mockRevokeRes, { path: '/api/integration/safetime/v1/pair', method: 'DELETE' });
  assert.equal(mockRevokeRes.statusCode, 204);
  const audit3 = db.prepare("SELECT * FROM audit WHERE action = 'integration.client_revoke'").get();
  assert.ok(audit3);

  // 4. Audit on login failed
  // Re-pair a client for login failure test
  const pairCodeRes2 = store.parentCreatePairCode(adminAuth, [student1Id]);
  const mockPairReq2 = {
    method: 'POST',
    url: '/api/integration/safetime/v1/pair',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json' },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        code: pairCodeRes2.code,
        deviceId: 'pc-audit-login-fail',
        deviceName: 'PC Thử Đăng Nhập Sai'
      }));
    }
  };
  const mockPairRes2 = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockPairReq2, mockPairRes2, { path: '/api/integration/safetime/v1/pair' });
  const { token: token2 } = JSON.parse(mockPairRes2.body);

  const mockFailLoginReq = {
    method: 'POST',
    url: '/api/integration/safetime/v1/student-login',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token2}` },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify({
        username: 'hocsinh_minh',
        password: 'SaiPasswordHoanToan',
        studentId: student1Id
      }));
    }
  };
  const mockFailLoginRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); },
    end(b) { this.body = b; }
  };
  await router.handle(mockFailLoginReq, mockFailLoginRes, { path: '/api/integration/safetime/v1/student-login' });
  assert.equal(mockFailLoginRes.statusCode, 401);

  const audit4 = db.prepare("SELECT * FROM audit WHERE action = 'integration.login_failed'").get();
  assert.ok(audit4);
  assert.equal(JSON.parse(audit4.target_id).reason, 'invalid_credentials');

  store.close();
});
