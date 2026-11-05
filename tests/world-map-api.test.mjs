import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createOnlineServer } from '../server/online-server.mjs';
import { createCloudApi } from '../server/cloud-api.mjs';
import { createPostgresFixture } from './helpers/postgres-fixture.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsRoot = path.join(projectRoot, 'test-results');
const setupToken = 'test-map-token-2026-super-secret-key-32ch';
const managerPassword = 'Manager-test-pass-2026!';
const studentPassword = 'Student-test-pass-2026!';

class LocalClient {
  constructor(origin) {
    this.origin = origin;
    this.cookie = '';
    this.csrfToken = '';
  }

  async request(route, { method = 'GET', body, headers = {} } = {}) {
    const isMutation = !['GET', 'HEAD'].includes(method);
    const reqHeaders = { 'X-Bao-An-Question-Protocol': '1', ...headers };
    if (this.cookie) reqHeaders.Cookie = this.cookie;
    if (isMutation) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders.Origin = this.origin;
      if (this.csrfToken) reqHeaders['X-CSRF-Token'] = this.csrfToken;
    }
    const response = await fetch(`${this.origin}/api/online${route}`, {
      method,
      headers: reqHeaders,
      redirect: 'manual',
      ...(isMutation ? { body: JSON.stringify(body ?? {}) } : {}),
    });

    const cookies = response.headers.getSetCookie();
    if (cookies.length) this.cookie = cookies.map((v) => v.split(';', 1)[0]).join('; ');
    const data = await response.json().catch(() => null);
    if (response.ok && typeof data?.csrfToken === 'string') this.csrfToken = data.csrfToken;
    return { status: response.status, ok: response.ok, headers: response.headers, data };
  }
}

async function localServerFixture(t) {
  await mkdir(resultsRoot, { recursive: true });
  const directory = await mkdtemp(path.join(resultsRoot, 'online-map-test-'));
  const staticRoot = path.join(directory, 'public');
  await mkdir(staticRoot);
  await writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>Map test</title>');
  const options = { databasePath: path.join(directory, 'online.sqlite'), staticRoot, setupToken, secureCookies: false };

  const server = await createOnlineServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await server.onlineClose?.();
    await rm(directory, { recursive: true, force: true });
  });

  return { origin, store: server.onlineStore };
}

test('API01, API02, API05: HTTP route /api/online/student/map on Local SQLite server', async (t) => {
  const { origin, store } = await localServerFixture(t);
  const client = new LocalClient(origin);

  // 1. Unauthenticated -> 401
  const unauth = await client.request('/student/map');
  assert.equal(unauth.status, 401);
  assert.match(unauth.headers.get('cache-control') || '', /no-store/i);

  // Setup manager and class
  await client.request('/setup', {
    method: 'POST',
    body: { token: setupToken, name: 'Trường Tiểu học', username: 'manager', password: managerPassword },
  });

  // Login manager
  const adminClient = new LocalClient(origin);
  await adminClient.request('/login', { method: 'POST', body: { username: 'manager', password: managerPassword } });

  // 2. Admin calling student/map -> 403
  const adminCall = await adminClient.request('/student/map');
  assert.equal(adminCall.status, 403);

  // Create student and login
  const cls = await adminClient.request('/classes', { method: 'POST', body: { name: 'Lớp 3A', grade: 3 } });
  await adminClient.request('/students', {
    method: 'POST',
    body: { classId: cls.data.id, name: 'Bảo An', username: 'baoan', password: studentPassword },
  });

  const studentClient = new LocalClient(origin);
  const loginRes = await studentClient.request('/login', {
    method: 'POST',
    body: { username: 'baoan', password: studentPassword },
  });
  assert.equal(loginRes.status, 200);

  // 3. Student calling student/map -> 200
  const mapRes = await studentClient.request('/student/map');
  assert.equal(mapRes.status, 200);
  assert.equal(mapRes.data.schemaVersion, 1);
  assert.equal(mapRes.data.totalWeeks, 0);
  assert.match(mapRes.headers.get('cache-control') || '', /no-store/i);

  // 4. Foreign query param -> 400
  const foreignRes = await studentClient.request('/student/map?studentId=other&classId=other');
  assert.equal(foreignRes.status, 400);

  // 5. Invalid region -> 400
  const invalidRegion = await studentClient.request('/student/map?region=nonexistent');
  assert.equal(invalidRegion.status, 400);

  // 6. Chapter without region -> 400
  const chapterNoRegion = await studentClient.request('/student/map?chapter=1');
  assert.equal(chapterNoRegion.status, 400);
});

test('API01, API02, API10: HTTP route /api/online/student/map on Cloud PostgreSQL API', async (t) => {
  const pgFixture = await createPostgresFixture(t, { bootstrap: false });
  const cloudOrigin = 'https://baoan.example.test';
  const storage = {
    async upload() {},
    async download() { return Buffer.from([]); },
    async remove() {},
  };
  const api = createCloudApi({ store: pgFixture.store, storage, publicOrigin: cloudOrigin, setupToken });

  class CloudClient {
    constructor() {
      this.cookie = '';
      this.csrf = '';
    }
    async request(route, { method = 'GET', body, headers = {} } = {}) {
      const isMutation = !['GET', 'HEAD'].includes(method);
      const reqHeaders = { 'X-Bao-An-Question-Protocol': '1', ...headers };
      if (this.cookie) reqHeaders.Cookie = this.cookie;
      if (isMutation) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders.Origin = cloudOrigin;
        if (this.csrf) reqHeaders['X-CSRF-Token'] = this.csrf;
      }
      const response = await api(
        new Request(`${cloudOrigin}/api/online${route}`, {
          method,
          headers: reqHeaders,
          ...(isMutation ? { body: JSON.stringify(body ?? {}) } : {}),
        }),
        { ip: '192.0.2.100' }
      );
      const cookies = response.headers.getSetCookie();
      if (cookies.length) this.cookie = cookies.map((v) => v.split(';', 1)[0]).join('; ');
      const data = await response.json().catch(() => null);
      if (response.ok && typeof data?.csrfToken === 'string') this.csrf = data.csrfToken;
      return { status: response.status, ok: response.ok, headers: response.headers, data };
    }
  }

  const client = new CloudClient();

  // 1. Unauthenticated -> 401
  const unauth = await client.request('/student/map');
  assert.equal(unauth.status, 401);

  // Setup manager
  await client.request('/setup', {
    method: 'POST',
    body: { token: setupToken, name: 'Trường Cloud', username: 'manager', password: managerPassword },
  });

  // Login manager
  const adminClient = new CloudClient();
  await adminClient.request('/login', { method: 'POST', body: { username: 'manager', password: managerPassword } });

  // 2. Admin calling student/map -> 403
  const adminRes = await adminClient.request('/student/map');
  assert.equal(adminRes.status, 403);

  // Create student and login
  const cls = await adminClient.request('/classes', { method: 'POST', body: { name: 'Lớp Cloud', grade: 3 } });
  await adminClient.request('/students', {
    method: 'POST',
    body: { classId: cls.data.id, name: 'Học sinh Cloud', username: 'cloudstudent', password: studentPassword },
  });

  const studentClient = new CloudClient();
  await studentClient.request('/login', { method: 'POST', body: { username: 'cloudstudent', password: studentPassword } });

  // 3. Student map -> 200
  const mapRes = await studentClient.request('/student/map');
  assert.equal(mapRes.status, 200);
  assert.equal(mapRes.data.schemaVersion, 1);
  assert.equal(mapRes.data.totalWeeks, 0);
  assert.equal(mapRes.data.regions.length, 5);

  // 4. Foreign parameters -> 400
  const foreignRes = await studentClient.request('/student/map?workspaceId=foreign');
  assert.equal(foreignRes.status, 400);
});
