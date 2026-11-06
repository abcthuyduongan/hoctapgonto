import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runStagingLoadTest } from '../tools/staging_load_runner.mjs';

test('R230: Staging load runner accurately counts HTTP 401/404/500 errors and reflects failure rate', async () => {
  // 1. Setup mock server that returns 401 for /api/online/student/journey
  const errServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/online/student/journey')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Yêu cầu đăng nhập tài khoản học sinh.' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  await new Promise(r => errServer.listen(0, '127.0.0.1', r));
  const errPort = errServer.address().port;
  const errOrigin = `http://127.0.0.1:${errPort}`;

  try {
    const report = await runStagingLoadTest({
      origin: errOrigin,
      concurrency: 2,
      durationSeconds: 1
    });

    assert.ok(report.totalErrors > 0, `Expected totalErrors > 0, got ${report.totalErrors}`);
    assert.equal(report.totalOperations, 0, 'No failed operations should count as successful');
    assert.equal(report.errorRatePercent, '100.00');
    assert.ok(report.sampleErrors.length > 0);
    assert.ok(report.sampleErrors.some(e => e.includes('HTTP 401')));
  } finally {
    await new Promise(r => errServer.close(r));
  }

  // 2. Setup mock server that returns 200 OK
  const okServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/online/student/journey')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ weeks: [] }));
    } else if (req.url?.startsWith('/icons/')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg></svg>');
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  });

  await new Promise(r => okServer.listen(0, '127.0.0.1', r));
  const okPort = okServer.address().port;
  const okOrigin = `http://127.0.0.1:${okPort}`;

  try {
    const report = await runStagingLoadTest({
      origin: okOrigin,
      concurrency: 2,
      durationSeconds: 1
    });

    assert.equal(report.totalErrors, 0, 'Successful operations should have 0 errors');
    assert.ok(report.totalOperations > 0, 'Successful operations should increment totalOperations');
    assert.equal(report.errorRatePercent, '0.00');
    assert.ok(report.metrics.journeySummary.count > 0);
  } finally {
    await new Promise(r => okServer.close(r));
  }
});

test('R231: Staging load runner parses baoan_online_session cookie and manages per-VU state', async () => {
  let receivedCookie = false;
  let receivedCsrf = false;

  const authServer = http.createServer((req, res) => {
    if (req.url === '/api/online/login' && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': 'baoan_online_session=auth_token_secret_123; Path=/; HttpOnly; SameSite=Lax'
      });
      res.end(JSON.stringify({ ok: true, csrfToken: 'vu_csrf_token_abc' }));
    } else if (req.url?.startsWith('/api/online/student/journey')) {
      const cookieHeader = req.headers.cookie || '';
      if (cookieHeader.includes('baoan_online_session=auth_token_secret_123')) {
        receivedCookie = true;
      }
      if (req.headers['x-csrf-token'] === 'vu_csrf_token_abc') {
        receivedCsrf = true;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ weeks: [] }));
    } else if (req.url?.startsWith('/icons/')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end('<svg></svg>');
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  });

  await new Promise(r => authServer.listen(0, '127.0.0.1', r));
  const authPort = authServer.address().port;
  const authOrigin = `http://127.0.0.1:${authPort}`;

  try {
    const report = await runStagingLoadTest({
      origin: authOrigin,
      concurrency: 1,
      durationSeconds: 1,
      studentPassword: 'valid-test-password'
    });

    assert.equal(report.totalErrors, 0);
    assert.ok(report.totalOperations > 0);
    assert.equal(receivedCookie, true, 'Expected runner to forward baoan_online_session cookie');
    assert.equal(receivedCsrf, true, 'Expected runner to forward per-VU CSRF token');
  } finally {
    await new Promise(r => authServer.close(r));
  }
});
