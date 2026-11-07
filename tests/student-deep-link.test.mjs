import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentDeepLink } from '../src/core/student-deep-link.ts';
import { sanitizeDeepLink } from '../server/safetime-integration.mjs';

test('Task 3B.7 (BAO-10): parseStudentDeepLink parses all supported targets', () => {
  // 1. Learning by subjects (hoc/{môn})
  const toan = parseStudentDeepLink('#/hoc/toan');
  assert.equal(toan.target, 'hoc');
  assert.equal(toan.subject, 'toan');
  assert.equal(toan.regionId, 'math');

  const tv = parseStudentDeepLink('hoc/tieng-viet');
  assert.equal(tv.target, 'hoc');
  assert.equal(tv.subject, 'tieng-viet');
  assert.equal(tv.regionId, 'vietnamese');

  const ta = parseStudentDeepLink('#hoc/tieng-anh');
  assert.equal(ta.target, 'hoc');
  assert.equal(ta.subject, 'tieng-anh');
  assert.equal(ta.regionId, 'english');

  const tin = parseStudentDeepLink('/hoc/tin-hoc');
  assert.equal(tin.target, 'hoc');
  assert.equal(tin.subject, 'tin-hoc');
  assert.equal(tin.regionId, 'computing');

  // 2. Daily missions (nhiem-vu)
  const nv = parseStudentDeepLink('#/nhiem-vu');
  assert.equal(nv.target, 'nhiem-vu');

  // 3. Contest preparation screen (thi/{presetId})
  const thiViolympic = parseStudentDeepLink('#/thi/violympic-math-g3');
  assert.equal(thiViolympic.target, 'thi');
  assert.equal(thiViolympic.presetId, 'violympic-math-g3');

  const thiIoe = parseStudentDeepLink('thi/ioe-english-g3');
  assert.equal(thiIoe.target, 'thi');
  assert.equal(thiIoe.presetId, 'ioe-english-g3');

  // 4. World map (ban-do)
  const map = parseStudentDeepLink('#/ban-do');
  assert.equal(map.target, 'ban-do');

  // 5. Gift shelf (qua)
  const qua = parseStudentDeepLink('#/qua');
  assert.equal(qua.target, 'qua');
});

test('Task 3B.7 (BAO-10): parseStudentDeepLink falls back safely to ban-do for invalid hashes', () => {
  assert.equal(parseStudentDeepLink('').target, 'ban-do');
  assert.equal(parseStudentDeepLink(null).target, 'ban-do');
  assert.equal(parseStudentDeepLink(undefined).target, 'ban-do');
  assert.equal(parseStudentDeepLink('#/').target, 'ban-do');
  assert.equal(parseStudentDeepLink('#/unknown/path').target, 'ban-do');
  assert.equal(parseStudentDeepLink('#/admin/dashboard').target, 'ban-do');
  assert.equal(parseStudentDeepLink('#/javascript:alert(1)').target, 'ban-do');
  assert.equal(parseStudentDeepLink('#/hoc/lich-su').target, 'ban-do');
});

test('Task 3B.7 (BAO-10, BAO-09): End-to-end alignment between sanitizeDeepLink and parseStudentDeepLink', () => {
  const allowedTargets = [
    'hoc/toan',
    'hoc/tieng-viet',
    'hoc/tieng-anh',
    'hoc/tin-hoc',
    'nhiem-vu',
    'thi/violympic-math-g3',
    'thi/ioe-english-g3',
    'ban-do',
    'qua'
  ];

  for (const target of allowedTargets) {
    const sanitized = sanitizeDeepLink(target);
    const parsed = parseStudentDeepLink(`#/${sanitized}`);
    if (target.startsWith('hoc/')) {
      assert.equal(parsed.target, 'hoc');
      assert.equal(parsed.subject, target.split('/')[1]);
    } else if (target.startsWith('thi/')) {
      assert.equal(parsed.target, 'thi');
      assert.equal(parsed.presetId, target.split('/')[1]);
    } else {
      assert.equal(parsed.target, target);
    }
  }

  // Suspicious targets sanitize to 'ban-do' and parse to 'ban-do'
  const suspiciousTargets = [
    '../../../etc/passwd',
    'https://malicious.com',
    'admin',
    'eval(1)'
  ];
  for (const bad of suspiciousTargets) {
    const sanitized = sanitizeDeepLink(bad);
    assert.equal(sanitized, 'ban-do');
    const parsed = parseStudentDeepLink(`#/${sanitized}`);
    assert.equal(parsed.target, 'ban-do');
  }
});
