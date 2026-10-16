import test from 'node:test';
import assert from 'node:assert/strict';

test('LearnerProfile: validates profile attributes', () => {
  const allowedAvatars = new Set(['fox', 'owl', 'bear', 'rabbit', 'cat']);
  
  function validateProfile(profile) {
    const errors = [];
    if (!profile.profileId || typeof profile.profileId !== 'string') errors.push('Thiếu ID hồ sơ.');
    if (!profile.name?.trim() || profile.name.trim().length > 40) errors.push('Tên hồ sơ phải từ 1-40 ký tự.');
    if (!allowedAvatars.has(profile.avatar)) errors.push('Avatar không hợp lệ.');
    if (!Number.isInteger(profile.grade) || profile.grade < 1 || profile.grade > 5) errors.push('Khối lớp phải từ 1 đến 5.');
    return errors;
  }

  const valid = {
    profileId: 'learner-1',
    name: 'Bé An',
    avatar: 'fox',
    grade: 3,
    colorTheme: 'teal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  assert.equal(validateProfile(valid).length, 0);

  const invalid = {
    profileId: '',
    name: '   ',
    avatar: 'dragon',
    grade: 13
  };
  const errors = validateProfile(invalid);
  assert.equal(errors.length, 4);
});

test('LearnerProfile: isolates session and event records per profile', () => {
  const sessions = [
    { sessionId: 's-1', profileId: 'learner-1', moduleId: 'math-quest', status: 'completed' },
    { sessionId: 's-2', profileId: 'learner-2', moduleId: 'math-quest', status: 'completed' },
    { sessionId: 's-3', moduleId: 'math-quest', status: 'completed' } // legacy session with no profileId
  ];

  const filterSessions = (rows, targetProfileId) => {
    return rows.filter(s => (s.profileId ?? 'default-learner') === targetProfileId);
  };

  const p1Sessions = filterSessions(sessions, 'learner-1');
  assert.equal(p1Sessions.length, 1);
  assert.equal(p1Sessions[0].sessionId, 's-1');

  const p2Sessions = filterSessions(sessions, 'learner-2');
  assert.equal(p2Sessions.length, 1);
  assert.equal(p2Sessions[0].sessionId, 's-2');

  const defaultSessions = filterSessions(sessions, 'default-learner');
  assert.equal(defaultSessions.length, 1);
  assert.equal(defaultSessions[0].sessionId, 's-3', 'Legacy session defaults to default-learner');
});
