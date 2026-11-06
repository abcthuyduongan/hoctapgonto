import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {createOnlineServer} from '../server/online-server.mjs';
import {createCloudApi} from '../server/cloud-api.mjs';
import {createPostgresFixture} from './helpers/postgres-fixture.mjs';

const password = 'Audit-secure-password-2026!';
const token = 'audit-bootstrap-token-20261106';

function client(send, origin) {
  let cookie = '', csrf = '', parentToken = '';
  return {
    setParentToken(tok) { parentToken = tok; },
    clearParentToken() { parentToken = ''; },
    async request(route, method = 'GET', body) {
      const headers = {
        'X-Bao-An-Question-Protocol': '1',
        ...(cookie ? {Cookie: cookie} : {}),
        ...(parentToken ? {'X-Parent-Token': parentToken} : {}),
        ...(method !== 'GET' ? {Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf} : {}),
      };
      const response = await send(new Request(origin + '/api/online' + route, {
        method,
        headers,
        ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
      }));
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) cookie = cookies.map(v => v.split(';', 1)[0]).join('; ');
      const data = await response.json();
      if (data.csrfToken) csrf = data.csrfToken;
      return {status: response.status, data};
    },
  };
}

async function harness(t, engine) {
  if (engine === 'SQLite HTTP') {
    const server = createOnlineServer({databasePath: ':memory:', staticRoot: resolve('dist'), setupToken: token, secureCookies: false});
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
      server.closeAllConnections?.();
      await new Promise(res => server.close(res));
      server.onlineClose();
    });
    return {origin: 'http://127.0.0.1:' + server.address().port, send: request => fetch(request)};
  }
  const f = await createPostgresFixture(t, {bootstrap: false});
  const origin = 'https://matrix-fixture.example.test';
  const api = createCloudApi({store: f.store, storage: {download: async () => Buffer.alloc(0), upload: async () => {}}, publicOrigin: origin, setupToken: token});
  return {origin, send: request => api(request, {ip: '192.0.2.120'})};
}

for (const engine of ['SQLite HTTP', 'PostgreSQL cloud adapter']) {
  test(`Parent Authorization Matrix [${engine}]: AU01-AU10 strict security controls`, async t => {
    const h = await harness(t, engine);
    const manager = client(h.send, h.origin);
    const childA = client(h.send, h.origin);
    const childB = client(h.send, h.origin);
    const parent = client(h.send, h.origin);

    // Bootstrap workspace
    const setupRes = await manager.request('/setup', 'POST', {token, name: 'Matrix Org', username: 'mgr.matrix', password});
    assert.equal(setupRes.status, 201);

    const clsRes = await manager.request('/classes', 'POST', {name: 'Class 3A', grade: 3});
    const cls = clsRes.data;

    const studentARes = await manager.request('/students', 'POST', {classId: cls.id, name: 'Student A', username: 'student.a', password});
    const studentA = studentARes.data.student;

    const studentBRes = await manager.request('/students', 'POST', {classId: cls.id, name: 'Student B', username: 'student.b', password});
    const studentB = studentBRes.data.student;

    // AU10: Setup PIN for Student A. Result must not expose pinHash or pinSalt
    const pinSetupRes = await manager.request('/parent/setup-pin', 'POST', {studentId: studentA.id, pin: '7342'});
    assert.equal(pinSetupRes.status, 200);
    assert.equal(pinSetupRes.data.success, true);
    assert.equal(pinSetupRes.data.pinHash, undefined);
    assert.equal(pinSetupRes.data.pinSalt, undefined);

    // Login as Student A
    const loginARes = await childA.request('/login', 'POST', {username: 'student.a', password});
    assert.equal(loginARes.status, 200);

    // AU01 & AU02: Student A without elevation attempts to read dashboard and modify settings -> 403 Forbidden
    const unverifiedDash = await childA.request('/parent/dashboard');
    assert.equal(unverifiedDash.status, 403, 'AU02: Student cannot view PIN-protected parent dashboard without elevation');

    const unverifiedSettings = await childA.request('/parent/settings', 'POST', {maxMinutesPerDay: 10, allowedStartHour: 8, allowedEndHour: 18});
    assert.equal(unverifiedSettings.status, 403, 'AU01: Student cannot update settings without elevation');

    // AU03: Wrong PIN verification fails and locks out after 5 attempts
    for (let i = 1; i <= 4; i++) {
      const wrongPin = await childA.request('/parent/verify-pin', 'POST', {pin: '0000'});
      assert.equal(wrongPin.status, 403);
      assert.match(wrongPin.data.error, /Sai mã PIN phụ huynh/);
    }
    const fifthWrongPin = await childA.request('/parent/verify-pin', 'POST', {pin: '0000'});
    assert.equal(fifthWrongPin.status, 429);
    assert.match(fifthWrongPin.data.error, /tạm khóa 15 phút/);

    // Even correct PIN is blocked when locked
    const correctWhileLocked = await childA.request('/parent/verify-pin', 'POST', {pin: '7342'});
    assert.equal(correctWhileLocked.status, 429);
    assert.match(correctWhileLocked.data.error, /tạm khóa/);

    // Admin resets PIN to unlock
    const adminReset = await manager.request('/parent/setup-pin', 'POST', {studentId: studentA.id, pin: '8888'});
    assert.equal(adminReset.status, 200);
    assert.equal(adminReset.data.success, true);

    // AU04: Verify correct PIN returns elevation token
    const correctPin = await childA.request('/parent/verify-pin', 'POST', {pin: '8888'});
    assert.equal(correctPin.status, 200);
    assert.ok(correctPin.data.parentToken, 'Elevation token issued');
    assert.equal(correctPin.data.pinHash, undefined);
    assert.equal(correctPin.data.pinSalt, undefined);

    // AU05: Provide elevation token -> Student can access dashboard and modify settings
    childA.setParentToken(correctPin.data.parentToken);
    const elevatedDash = await childA.request('/parent/dashboard');
    assert.equal(elevatedDash.status, 200);
    assert.equal(elevatedDash.data.controls.pinHash, undefined);
    assert.equal(elevatedDash.data.controls.pinSalt, undefined);

    const elevatedSettings = await childA.request('/parent/settings', 'POST', {maxMinutesPerDay: 45, allowedStartHour: 8, allowedEndHour: 20});
    assert.equal(elevatedSettings.status, 200);
    assert.equal(elevatedSettings.data.maxMinutesPerDay, 45);
    assert.equal(elevatedSettings.data.pinHash, undefined);
    assert.equal(elevatedSettings.data.pinSalt, undefined);

    // AU06: Changing PIN invalidates existing elevation tokens
    const changePinRes = await childA.request('/parent/setup-pin', 'POST', {pin: '9999'});
    assert.equal(changePinRes.status, 200);

    const staleTokenDash = await childA.request('/parent/dashboard');
    assert.equal(staleTokenDash.status, 403, 'AU06: Stale elevation token is rejected after PIN change');

    // Create a Parent user linked only to Student A
    const parentCreateRes = await manager.request('/parents', 'POST', {
      name: 'Parent of A',
      username: 'parent.a',
      password,
      studentIds: [studentA.id],
    });
    assert.equal(parentCreateRes.status, 201);

    const parentLoginRes = await parent.request('/login', 'POST', {username: 'parent.a', password});
    assert.equal(parentLoginRes.status, 200);

    // AU08: Linked parent can access student A without needing student elevation token
    const parentDashA = await parent.request(`/parent/dashboard?studentId=${studentA.id}`);
    assert.equal(parentDashA.status, 200);
    assert.equal(parentDashA.data.controls.pinHash, undefined);
    assert.equal(parentDashA.data.controls.pinSalt, undefined);

    const parentSettingsA = await parent.request('/parent/settings', 'POST', {
      studentId: studentA.id,
      maxMinutesPerDay: 50,
      allowedStartHour: 7,
      allowedEndHour: 21,
    });
    assert.equal(parentSettingsA.status, 200);
    assert.equal(parentSettingsA.data.maxMinutesPerDay, 50);

    // AU07: Parent trying to access Student B (unlinked) must receive 403 on both dashboard and settings
    const parentDashB = await parent.request(`/parent/dashboard?studentId=${studentB.id}`);
    assert.equal(parentDashB.status, 403, 'AU07: Unlinked parent denied reading dashboard of Student B');

    const parentSettingsB = await parent.request('/parent/settings', 'POST', {
      studentId: studentB.id,
      maxMinutesPerDay: 99,
      allowedStartHour: 0,
      allowedEndHour: 24,
    });
    assert.equal(parentSettingsB.status, 403, 'AU07: Unlinked parent denied modifying settings of Student B');

    // AU09: Admin can access any student without elevation token
    const adminDashB = await manager.request(`/parent/dashboard?studentId=${studentB.id}`);
    assert.equal(adminDashB.status, 200, 'AU09: Admin can access Student B dashboard');

    const adminSettingsB = await manager.request('/parent/settings', 'POST', {
      studentId: studentB.id,
      maxMinutesPerDay: 60,
      allowedStartHour: 8,
      allowedEndHour: 20,
    });
    assert.equal(adminSettingsB.status, 200, 'AU09: Admin can update Student B settings');
  });
}
