import { randomBytes, createHash } from 'node:crypto';
import { parseJsonBody } from './json-body.mjs';
import { ONLINE_RUNTIME_VERSION } from './api-diagnostics.mjs';

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
 * Creates the SafeTime Integration Router for handling /api/integration/safetime/v1 endpoints (BAO-01, BAO-05, BAO-06).
 */
export function createSafeTimeIntegrationRouter({ store, db }) {
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

  function isIntegrationEnabled() {
    const hasCode = db.prepare('SELECT 1 FROM integration_pair_codes LIMIT 1').get();
    const hasClient = db.prepare('SELECT 1 FROM integration_clients LIMIT 1').get();
    return Boolean(hasCode || hasClient);
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

  async function handle(req, res, { path, method }) {
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

      // Placeholders for subsequent tasks 3B.3 - 3B.6
      if (['/student-login', '/student-refresh', '/student-logout', '/sso', '/events'].includes(subPath) || subPath.startsWith('/students/')) {
        sendError(res, 501, 'not_implemented', 'Chức năng đang được hoàn thiện ở task tiếp theo.');
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
