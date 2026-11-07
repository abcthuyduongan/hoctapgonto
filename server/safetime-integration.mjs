import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { parseJsonBody } from './json-body.mjs';
import { ONLINE_RUNTIME_VERSION } from './api-diagnostics.mjs';

const scrypt = promisify(scryptCallback);
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Checks if an IP address belongs to loopback interface (BAO-05).
 * Accepts IPv4 127.0.0.1, IPv6 ::1, and IPv4-mapped IPv6 ::ffff:127.0.0.1.
 */
export function isLoopbackAddress(address) {
  if (!address) return false;
  return address === '127.0.0.1' ||
         address === '::1' ||
         address === '::ffff:127.0.0.1';
}

/**
 * Sanitizes and validates deep-link targets according to BAO-09 and ket-noi-bao-an.md section 5.1.
 * Supported targets:
 * - hoc/toan, hoc/tieng-viet, hoc/tieng-anh, hoc/tin-hoc
 * - nhiem-vu
 * - thi/{presetId}
 * - ban-do
 * - qua
 * Any other value falls back safely to 'ban-do'.
 */
export function sanitizeDeepLink(to) {
  if (!to || typeof to !== 'string') return 'ban-do';
  const trimmed = to.trim().replace(/^#\/?/, '').replace(/^\//, '');
  if (/^hoc\/(toan|tieng-viet|tieng-anh|tin-hoc)$/.test(trimmed)) return trimmed;
  if (trimmed === 'nhiem-vu') return trimmed;
  if (/^thi\/[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) return trimmed;
  if (trimmed === 'ban-do') return trimmed;
  if (trimmed === 'qua') return trimmed;
  return 'ban-do';
}

/**
 * Normalizes subject identifier or label to one of the 4 standard keys (BAO-10, BAO-12):
 * 'toan', 'tieng-viet', 'tieng-anh', 'tin-hoc'
 */
export function normalizeIntegrationSubject(subjectOrLabel) {
  const raw = String(subjectOrLabel || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
  if (raw.includes('toan') || raw.includes('math')) return 'toan';
  if (raw.includes('viet')) return 'tieng-viet';
  if (raw.includes('anh') || raw.includes('english')) return 'tieng-anh';
  if (raw.includes('tin') || raw.includes('computing') || raw.includes('cong nghe')) return 'tin-hoc';
  return 'toan';
}

function createDefaultAuthenticator({ store, db }) {
  const hash = value => createHash('sha256').update(value).digest('hex');
  const dummySalt = randomBytes(16).toString('hex');

  async function verifyPassword(value, stored) {
    if (typeof value !== 'string' || value.length > 128) return false;
    const [salt, expected] = (stored ?? `${dummySalt}:dummy`).split(':');
    const result = await scrypt(value, salt, 64, scryptOptions);
    const expectedBuf = createHash('sha256').update(String(expected ?? '')).digest();
    const actualBuf = createHash('sha256').update(result.toString('hex')).digest();
    return timingSafeEqual(actualBuf, expectedBuf);
  }

  function rateLimit(req, name) {
    const address = req.socket?.remoteAddress ?? 'local';
    const keys = [hash(`ip:${address}`), hash(`user:${name}`)];
    const time = Date.now();
    store.tx(() => {
      db.prepare('DELETE FROM login_limits WHERE key IN (SELECT key FROM login_limits WHERE reset_at<=? AND key NOT IN (?,?) ORDER BY reset_at,key LIMIT 100)').run(time, ...keys);
      for (const [index, key] of keys.entries()) {
        const row = db.prepare('SELECT * FROM login_limits WHERE key=?').get(key);
        const count = row && row.reset_at > time ? row.count : 0;
        if (count >= (index === 0 ? 100 : 12)) {
          const err = new Error('Đã thử đăng nhập quá nhiều lần. Hãy đợi 15 phút rồi thử lại.');
          err.status = 429;
          err.code = 'login_rate_limited';
          throw err;
        }
        db.prepare('INSERT INTO login_limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at').run(key, count + 1, row && row.reset_at > time ? row.reset_at : time + 900000);
      }
    });
    return () => db.prepare('DELETE FROM login_limits WHERE key=?').run(keys[1]);
  }

  return async function defaultAuthenticate({ req, rawUsername, rawPassword }) {
    const name = String(rawUsername || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(name)) {
      const err = new Error('Tên đăng nhập cần 3–60 chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
      err.status = 400;
      err.code = 'invalid_username';
      throw err;
    }
    const clear = rateLimit(req, name);
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(name);
    const correct = await verifyPassword(rawPassword, user?.password_hash);
    const current = user && db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    if (!correct || !current || !current.active || current.password_hash !== user.password_hash) {
      const err = new Error('Tên đăng nhập hoặc mật khẩu chưa đúng.');
      err.status = 401;
      err.code = 'invalid_credentials';
      throw err;
    }
    clear();
    return current;
  };
}

function defaultCreateSession(res, user, origin, db) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?, ?)').run(tokenHash, user.id, csrfToken, Date.now() + 43200000);
  const secure = origin?.startsWith('https:') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `baoan_online_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
  return { token, csrfToken };
}

/**
 * Creates the SafeTime Integration Router for handling /api/integration/safetime/v1 endpoints (BAO-01, BAO-05, BAO-06, BAO-07, BAO-08, BAO-09).
 */
export function createSafeTimeIntegrationRouter({ store, db, authenticateUserCredentials, createStudentSession }) {
  const authFn = authenticateUserCredentials || createDefaultAuthenticator({ store, db });
  const sessionFn = createStudentSession || ((res, user, origin) => defaultCreateSession(res, user, origin, db));

  // In-memory rate limiting map: tokenHash -> { count, windowStart }
  const rateLimitMap = new Map();
  // Brute-force protection for pair code: 5 failed attempts locks for 15 minutes
  let pairFailedAttempts = 0;
  let pairLockUntil = 0;

  function resetSecurityState() {
    rateLimitMap.clear();
    pairFailedAttempts = 0;
    pairLockUntil = 0;
  }

  function checkRateLimit(tokenHash) {
    const now = Date.now();
    const entry = rateLimitMap.get(tokenHash);
    if (!entry || now - entry.windowStart >= 60000) {
      rateLimitMap.set(tokenHash, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= 120) {
      return false;
    }
    entry.count++;
    return true;
  }

  function checkPairBruteForce() {
    const now = Date.now();
    if (now < pairLockUntil) {
      return false;
    }
    return true;
  }

  function recordPairFailure() {
    pairFailedAttempts++;
    if (pairFailedAttempts >= 5) {
      pairLockUntil = Date.now() + 15 * 60 * 1000;
      pairFailedAttempts = 0;
    }
  }

  function recordPairSuccess() {
    pairFailedAttempts = 0;
    pairLockUntil = 0;
  }

  function sendJson(res, status, data) {
    const jsonString = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(jsonString),
      'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache',
      'X-Integration-Version': '1',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    res.end(jsonString);
  }

  function sendError(res, status, code, message) {
    sendJson(res, status, {
      error: {
        code,
        message
      }
    });
  }

  function isIntegrationEnabled(workspaceId = null) {
    if (workspaceId && typeof store.isIntegrationEnabled === 'function') {
      return store.isIntegrationEnabled(workspaceId);
    }
    const pairCode = db.prepare('SELECT workspace_id FROM integration_pair_codes LIMIT 1').get();
    const client = db.prepare('SELECT workspace_id FROM integration_clients LIMIT 1').get();
    const wsId = workspaceId || pairCode?.workspace_id || client?.workspace_id;
    if (wsId && typeof store.isIntegrationEnabled === 'function') {
      return store.isIntegrationEnabled(wsId);
    }
    return Boolean(pairCode || client);
  }

  async function parseBody(req, maxBytes = 2 * 1024 * 1024) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
      throw { status: 415, code: 'unsupported_media_type', message: 'Yêu cầu phải dùng định dạng JSON.' };
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) {
        throw { status: 413, code: 'payload_too_large', message: 'Gói dữ liệu vượt quá giới hạn cho phép.' };
      }
      chunks.push(chunk);
    }
    try {
      return await parseJsonBody(Buffer.concat(chunks), req.headers['content-encoding'], maxBytes);
    } catch (err) {
      throw { status: err.status || 400, code: 'invalid_json', message: err.message || 'Dữ liệu JSON không hợp lệ.' };
    }
  }

  function authenticateBearer(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return { error: { status: 401, code: 'unauthorized', message: 'Cần cung cấp khóa kết nối trong tiêu đề Authorization.' } };
    }
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!match || !match[1].trim()) {
      return { error: { status: 401, code: 'unauthorized', message: 'Tiêu đề Authorization phải có dạng Bearer <khóa>.' } };
    }
    const rawToken = match[1].trim();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const client = store.findIntegrationClientByTokenHash(tokenHash);
    if (!client || client.revoked_at) {
      return { error: { status: 401, code: 'unauthorized', message: 'Khóa kết nối không hợp lệ hoặc đã bị thu hồi.' } };
    }
    if(!isIntegrationEnabled(client.workspace_id))return{error:{status:403,code:'integration_disabled',message:'Phụ huynh đã tắt kết nối.'}};
    if (!checkRateLimit(tokenHash)) {
      return { error: { status: 429, code: 'rate_limited', message: 'Vượt quá giới hạn tần suất yêu cầu (tối đa 120 yêu cầu/phút).' } };
    }
    store.touchIntegrationClient(client.id);
    return { client, rawToken, tokenHash };
  }

  function getStudentsForClient(client) {
    const allowedIds = client.allowed_student_ids || [];
    if (Array.isArray(allowedIds) && allowedIds.length > 0) {
      const placeholders = allowedIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT s.id, s.name AS displayName, c.name AS className
        FROM students s
        JOIN classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
        WHERE s.workspace_id = ? AND s.id IN (${placeholders}) AND s.active = 1
        ORDER BY s.name ASC
      `).all(client.workspace_id, ...allowedIds);
      return rows;
    }
    const rows = db.prepare(`
      SELECT s.id, s.name AS displayName, c.name AS className
      FROM students s
      JOIN classes c ON c.workspace_id = s.workspace_id AND c.id = s.class_id
      WHERE s.workspace_id = ? AND s.active = 1
      ORDER BY s.name ASC
    `).all(client.workspace_id);
    return rows;
  }

  async function handle(req, res, context = {}) {
    const parsedUrl = context.url || new URL(req.url || '/', context.origin || 'http://127.0.0.1');
    const path = context.path || parsedUrl.pathname;
    const method = (context.method || req.method || 'GET').toUpperCase();
    const url = parsedUrl;
    const origin = context.origin || parsedUrl.origin || 'http://127.0.0.1';
    // 1. Loopback enforcement (BAO-05)
    const remoteAddress = req.socket?.remoteAddress;
    if (!isLoopbackAddress(remoteAddress)) {
      sendError(res, 403, 'forbidden_remote', 'Cổng kết nối chỉ nhận yêu cầu từ loopback (127.0.0.1 / ::1).');
      return true;
    }

    // 2. Integration prefix check (BAO-06)
    const prefix = '/api/integration/safetime/v1';
    if (!path.startsWith(prefix)) {
      sendError(res, 404, 'unsupported_version', 'Phiên bản API tích hợp không đúng hoặc không tồn tại. Yêu cầu tiền tố /api/integration/safetime/v1.');
      return true;
    }

    const subPath = path.slice(prefix.length) || '/';
    const requestUrl = url || new URL(req.url, origin || 'http://127.0.0.1');

    try {
      // Command 1: GET /status
      if (subPath === '/status') {
        if (method !== 'GET') {
          sendError(res, 405, 'method_not_allowed', 'Phương thức không được hỗ trợ cho endpoint /status.');
          return true;
        }
        const activeClient = db.prepare('SELECT 1 FROM integration_clients WHERE revoked_at IS NULL LIMIT 1').get();
        sendJson(res, 200, {
          version: ONLINE_RUNTIME_VERSION,
          integrationVersion: 1,
          paired: Boolean(activeClient)
        });
        return true;
      }

      // Command 2: POST /pair
      if (subPath === '/pair' && method === 'POST') {
        if (!checkPairBruteForce()) {
          sendError(res, 429, 'pair_locked', 'Mã ghép đôi đã thử sai 5 lần. Cổng ghép đôi bị khóa 15 phút.');
          return true;
        }
        if (!isIntegrationEnabled()) {
          sendError(res, 403, 'integration_disabled', 'Cổng kết nối chưa được kích hoạt. Phụ huynh hãy mở Bảo An để tạo mã ghép đôi.');
          return true;
        }

        const input = await parseBody(req);
        const code = String(input?.code || '').trim().toUpperCase();
        const deviceName = String(input?.deviceName || '').trim();
        const deviceId = String(input?.deviceId || '').trim();

        if (!code || !deviceName || !deviceId) {
          sendError(res, 400, 'invalid_payload', 'Cần cung cấp đầy đủ mã ghép đôi (code), tên thiết bị (deviceName) và mã thiết bị (deviceId).');
          return true;
        }

        const pairCode = store.findIntegrationPairCode(code);
        if (!pairCode || pairCode.used_at || new Date(pairCode.expires_at) <= new Date()) {
          recordPairFailure();
          sendError(res, 400, 'invalid_pair_code', 'Mã ghép đôi không đúng, đã dùng hoặc đã hết hạn.');
          return true;
        }
        if(!isIntegrationEnabled(pairCode.workspace_id)){
          sendError(res,403,'integration_disabled','Kết nối của không gian này đã bị tắt.');return true;
        }

        recordPairSuccess();
        store.consumeIntegrationPairCode(code);

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        const client = store.createIntegrationClient(pairCode.workspace_id, {
          tokenHash,
          deviceId,
          deviceName,
          allowedStudentIds: pairCode.allowed_student_ids
        });

        // Audit log (BAO-16)
        if (typeof store.audit === 'function') {
          try {
            store.audit(
              { workspaceId: pairCode.workspace_id, id: 'system' },
              'integration.pair',
              JSON.stringify({ clientId: client.id, deviceId, deviceName, allowedStudentIds: pairCode.allowed_student_ids })
            );
          } catch {}
        }

        const workspace = store.workspace(pairCode.workspace_id);
        const students = getStudentsForClient(client);

        sendJson(res, 200, {
          token: rawToken,
          workspace: {
            id: workspace.id,
            name: workspace.name
          },
          students
        });
        return true;
      }

      // Command 3: DELETE /pair
      if (subPath === '/pair' && method === 'DELETE') {
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }
        store.revokeIntegrationClient(auth.client.id);
        // Audit log (BAO-16)
        if (typeof store.audit === 'function') {
          try {
            store.audit(
              { workspaceId: auth.client.workspace_id, id: 'system' },
              'integration.client_revoke',
              JSON.stringify({ clientId: auth.client.id, deviceId: auth.client.device_id, deviceName: auth.client.device_name, source: 'client' })
            );
          } catch {}
        }
        res.writeHead(204, {
          'Cache-Control': 'no-store, private',
          'Pragma': 'no-cache',
          'X-Integration-Version': '1'
        });
        res.end();
        return true;
      }

      // Command 4: GET /students
      if (subPath === '/students') {
        if (method !== 'GET') {
          sendError(res, 405, 'method_not_allowed', 'Phương thức không được hỗ trợ cho endpoint /students.');
          return true;
        }
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }
        const students = getStudentsForClient(auth.client);
        sendJson(res, 200, students);
        return true;
      }

      // Command 5: POST /student-login (BAO-07)
      if (subPath === '/student-login' && method === 'POST') {
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }

        const input = await parseBody(req);
        const username = String(input?.username || '').trim();
        const password = String(input?.password || '');
        const studentId = String(input?.studentId || '').trim();
        const remember = Boolean(input?.remember);

        if (!username || !password || !studentId) {
          sendError(res, 400, 'invalid_payload', 'Cần cung cấp tên đăng nhập (username), mật khẩu (password) và mã học sinh (studentId).');
          return true;
        }

        // Check if studentId is allowed on this client (BAO-07)
        if (Array.isArray(auth.client.allowed_student_ids) && auth.client.allowed_student_ids.length > 0) {
          if (!auth.client.allowed_student_ids.includes(studentId)) {
            if (typeof store.audit === 'function') {
              try {
                store.audit(
                  { workspaceId: auth.client.workspace_id, id: 'system' },
                  'integration.login_failed',
                  JSON.stringify({ clientId: auth.client.id, studentId, username, reason: 'student_not_allowed' })
                );
              } catch {}
            }
            sendError(res, 403, 'student_not_allowed', 'Học sinh này chưa được bố mẹ cấp phép trên thiết bị này.');
            return true;
          }
        }

        // Authenticate credentials using shared /login verification & rate-limiting logic (BAO-07)
        let user;
        try {
          user = await authFn({ req, rawUsername: username, rawPassword: password });
        } catch (err) {
          if (typeof store.audit === 'function') {
            try {
              store.audit(
                { workspaceId: auth.client.workspace_id, id: 'system' },
                'integration.login_failed',
                JSON.stringify({ clientId: auth.client.id, studentId, username, reason: 'invalid_credentials' })
              );
            } catch {}
          }
          const status = err.status || 401;
          const code = status === 429 ? 'login_rate_limited' : 'invalid_credentials';
          sendError(res, status, code, err.message || 'Tên đăng nhập hoặc mật khẩu chưa đúng.');
          return true;
        }

        // Must be a student account
        if (user.role !== 'student') {
          if (typeof store.audit === 'function') {
            try {
              store.audit(
                { workspaceId: auth.client.workspace_id, id: 'system' },
                'integration.login_failed',
                JSON.stringify({ clientId: auth.client.id, studentId, username, reason: 'not_student' })
              );
            } catch {}
          }
          sendError(res, 403, 'not_student', 'Chỉ tài khoản học sinh mới có thể đăng nhập qua cổng này.');
          return true;
        }

        // Must match the requested studentId (BAO-07, LNK-09)
        if (user.student_id !== studentId) {
          if (typeof store.audit === 'function') {
            try {
              store.audit(
                { workspaceId: auth.client.workspace_id, id: 'system' },
                'integration.login_failed',
                JSON.stringify({ clientId: auth.client.id, studentId, username, reason: 'wrong_student' })
              );
            } catch {}
          }
          sendError(res, 403, 'wrong_student', 'Tài khoản này không phải của bạn trên máy này. Hỏi bố mẹ nhé.');
          return true;
        }

        // Fetch student record
        const student = db.prepare('SELECT id, name FROM students WHERE workspace_id = ? AND id = ? AND active = 1').get(auth.client.workspace_id, studentId);
        if (!student) {
          sendError(res, 404, 'student_not_found', 'Không tìm thấy thông tin học sinh trong đơn vị.');
          return true;
        }

        // Generate one-time 60s SSO ticket (BAO-08)
        const { ticket } = store.createIntegrationTicket(auth.client.workspace_id, auth.client.id, student.id, 60);

        // If remember is requested, generate 30-day refresh token (BAO-08)
        let refreshToken;
        if (remember) {
          const result = store.createIntegrationRefreshToken(auth.client.workspace_id, auth.client.id, student.id, 30);
          refreshToken = result.rawToken;
        }

        sendJson(res, 200, {
          student: {
            id: student.id,
            displayName: student.name
          },
          ticket,
          ...(refreshToken ? { refreshToken } : {})
        });
        return true;
      }

      // Command 6: POST /student-refresh (BAO-08)
      if (subPath === '/student-refresh' && method === 'POST') {
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }

        const input = await parseBody(req);
        const refreshToken = String(input?.refreshToken || '').trim();
        const studentId = String(input?.studentId || '').trim();

        if (!refreshToken || !studentId) {
          sendError(res, 400, 'invalid_payload', 'Cần cung cấp mã làm mới (refreshToken) và mã học sinh (studentId).');
          return true;
        }

        if (Array.isArray(auth.client.allowed_student_ids) && auth.client.allowed_student_ids.length > 0) {
          if (!auth.client.allowed_student_ids.includes(studentId)) {
            sendError(res, 403, 'student_not_allowed', 'Học sinh này chưa được bố mẹ cấp phép trên thiết bị này.');
            return true;
          }
        }

        const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
        const tokenRow = db.prepare('SELECT * FROM integration_refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL').get(tokenHash);
        if (!tokenRow) {
          sendError(res, 401, 'invalid_refresh_token', 'Mã làm mới không hợp lệ hoặc đã bị thu hồi.');
          return true;
        }
        if (new Date(tokenRow.expires_at) <= new Date()) {
          sendError(res, 401, 'invalid_refresh_token', 'Mã làm mới đã hết hạn.');
          return true;
        }
        if (tokenRow.client_id !== auth.client.id || tokenRow.student_id !== studentId) {
          sendError(res, 403, 'token_mismatch', 'Mã làm mới không thuộc về học sinh hoặc thiết bị này.');
          return true;
        }

        // Consume the refresh token now that ownership is confirmed (BAO-08)
        db.prepare('UPDATE integration_refresh_tokens SET revoked_at = ? WHERE token_hash = ?').run(new Date().toISOString(), tokenHash);

        // Mint new SSO ticket (60s) and new rotated refresh token (30 days) (BAO-08)
        const { ticket } = store.createIntegrationTicket(auth.client.workspace_id, auth.client.id, studentId, 60);
        const { rawToken: newRefreshToken } = store.createIntegrationRefreshToken(auth.client.workspace_id, auth.client.id, studentId, 30);

        sendJson(res, 200, {
          ticket,
          refreshToken: newRefreshToken
        });
        return true;
      }

      // Command 7: POST /student-logout (BAO-08)
      if (subPath === '/student-logout' && method === 'POST') {
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }

        let input = null;
        try {
          input = await parseBody(req);
        } catch {
          // Body is optional
        }

        const refreshToken = input?.refreshToken ? String(input.refreshToken).trim() : null;
        const nowIso = new Date().toISOString();

        if (refreshToken) {
          const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
          db.prepare('UPDATE integration_refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND client_id = ? AND revoked_at IS NULL')
            .run(nowIso, tokenHash, auth.client.id);
        } else {
          db.prepare('UPDATE integration_refresh_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL')
            .run(nowIso, auth.client.id);
        }

        res.writeHead(204, {
          'Cache-Control': 'no-store, private',
          'Pragma': 'no-cache',
          'X-Integration-Version': '1'
        });
        res.end();
        return true;
      }

      // Command 8: GET /sso?ticket=...&to=... (BAO-08, BAO-09)
      if (subPath === '/sso' && method === 'GET') {
        const ticket = String(requestUrl.searchParams.get('ticket') || '').trim();
        const rawTo = requestUrl.searchParams.get('to');

        if (!ticket) {
          sendError(res, 400, 'missing_ticket', 'Cần cung cấp vé SSO (ticket).');
          return true;
        }

        let ticketRecord;
        try {
          ticketRecord = store.consumeIntegrationTicket(ticket);
        } catch (err) {
          sendError(res, 400, 'invalid_ticket', err.message || 'Vé SSO không đúng hoặc đã hết hạn.');
          return true;
        }

        const student = db.prepare(`
          SELECT s.*, u.id AS user_id, u.username, u.role
          FROM students s
          JOIN users u ON u.id = s.user_id
          WHERE s.workspace_id = ? AND s.id = ? AND s.active = 1
        `).get(ticketRecord.workspace_id, ticketRecord.student_id);

        if (!student) {
          sendError(res, 404, 'student_not_found', 'Không tìm thấy thông tin học sinh trong đơn vị.');
          return true;
        }

        const cleanTo = sanitizeDeepLink(rawTo);
        const userObj = {
          id: student.user_id,
          workspace_id: ticketRecord.workspace_id,
          username: student.username,
          role: student.role,
          student_id: student.id
        };

        // Create standard student session (cookie + auth_sessions) (BAO-09)
        sessionFn(res, userObj, origin);

        // Redirect 302 to destination (BAO-09)
        res.writeHead(302, {
          Location: `/?online=1#/${cleanTo}`,
          'Cache-Control': 'no-store, private',
          'Pragma': 'no-cache',
          'X-Integration-Version': '1'
        });
        res.end();
        return true;
      }

      // Command 10: GET /events?after={cursor}&limit=100 (BAO-12)
      if (subPath === '/events' && method === 'GET') {
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }

        const rawAfter = requestUrl.searchParams.get('after');
        const rawLimit = requestUrl.searchParams.get('limit');
        const afterCursor = rawAfter !== null ? Number(rawAfter) || 0 : 0;
        const limit = rawLimit !== null ? Math.min(Math.max(1, parseInt(rawLimit, 10) || 100), 200) : 100;

        const allowedStudentIds = Array.isArray(auth.client.allowed_student_ids) && auth.client.allowed_student_ids.length > 0
          ? auth.client.allowed_student_ids
          : null;

        const result = store.listIntegrationEvents(auth.client.workspace_id, {
          allowedStudentIds,
          afterCursor,
          limit
        });

        sendJson(res, 200, result);
        return true;
      }

      // Command 9: GET /students/{id}/today (BAO-11)
      const studentTodayMatch = subPath.match(/^\/students\/([^/]+)\/today$/);
      if (studentTodayMatch && method === 'GET') {
        const auth = authenticateBearer(req);
        if (auth.error) {
          sendError(res, auth.error.status, auth.error.code, auth.error.message);
          return true;
        }

        const studentId = decodeURIComponent(studentTodayMatch[1]).trim();
        if (!studentId) {
          sendError(res, 400, 'invalid_student_id', 'Mã học sinh không hợp lệ.');
          return true;
        }

        if (Array.isArray(auth.client.allowed_student_ids) && auth.client.allowed_student_ids.length > 0) {
          if (!auth.client.allowed_student_ids.includes(studentId)) {
            sendError(res, 403, 'student_not_allowed', 'Học sinh này chưa được bố mẹ cấp phép trên thiết bị này.');
            return true;
          }
        }

        const todayData = store.getStudentTodayData(auth.client.workspace_id, studentId);
        if (!todayData) {
          sendError(res, 404, 'student_not_found', 'Không tìm thấy thông tin học sinh trong đơn vị.');
          return true;
        }

        sendJson(res, 200, todayData);
        return true;
      }

      // Unknown endpoint under integration prefix
      sendError(res, 404, 'not_found', 'Không tìm thấy API tích hợp này.');
      return true;
    } catch (err) {
      if (err.status && err.code) {
        sendError(res, err.status, err.code, err.message);
        return true;
      }
      sendError(res, 500, 'internal_error', err.message || 'Lỗi hệ thống khi xử lý yêu cầu tích hợp.');
      return true;
    }
  }

  return {
    handle,
    resetSecurityState,
    isIntegrationEnabled,
    checkRateLimit,
    checkPairBruteForce,
    authenticateBearer,
    getStudentsForClient
  };
}
