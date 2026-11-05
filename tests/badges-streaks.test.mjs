// tests/badges-streaks.test.mjs
// Unit & Integration tests for Badges, Streaks, and Daily Missions (Tuần 4 - Cổng C4)

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {OnlineStore} from '../server/online-store.mjs';
import {
  toVietnamDateString,
  getVietnamWeekKey,
  dayDifference,
  computeStreakState,
  registerDailyCorrectAnswer,
  buildDailyMissions,
  buildStudentBadgeStatuses,
  BADGE_CATALOG,
  DAILY_STREAK_TARGET_CORRECT,
} from '../src/core/badges.ts';

test('Timezone boundary: 23:59 and 00:01 in Vietnam time strictly belong to two different days', () => {
  // 23:59:00 on 2026-11-05 in Vietnam (UTC+7) corresponds to 16:59:00 UTC
  const lateNightUtc = '2026-11-05T16:59:00.000Z';
  const vnLateNight = toVietnamDateString(lateNightUtc);
  assert.equal(vnLateNight, '2026-11-05', '16:59 UTC must be 23:59 on 2026-11-05 in VN');

  // 00:01:00 on 2026-11-06 in Vietnam (UTC+7) corresponds to 17:01:00 UTC
  const pastMidnightUtc = '2026-11-05T17:01:00.000Z';
  const vnPastMidnight = toVietnamDateString(pastMidnightUtc);
  assert.equal(vnPastMidnight, '2026-11-06', '17:01 UTC must be 00:01 on 2026-11-06 in VN');

  // Strictly two consecutive days
  assert.equal(dayDifference(vnLateNight, vnPastMidnight), 1);
  assert.notEqual(vnLateNight, vnPastMidnight);
});

test('Streak pure functions: qualification, daily increment, freeze, and reset', () => {
  // Day 1: 4 correct answers -> not qualified yet
  let record = null;
  const day1Iso = '2026-11-02T03:00:00.000Z'; // Monday 10:00 VN
  for (let i = 0; i < 4; i++) {
    const res = registerDailyCorrectAnswer(record, true, day1Iso);
    record = res.newStreakRecord;
    assert.equal(res.qualifiedToday, false);
    assert.equal(res.streakIncreased, false);
  }
  assert.equal(record.today_correct_count, 4);
  assert.equal(record.current_streak, 0);

  // 5th correct answer qualifies Day 1!
  const fifth = registerDailyCorrectAnswer(record, true, day1Iso);
  record = fifth.newStreakRecord;
  assert.equal(fifth.qualifiedToday, true);
  assert.equal(fifth.streakIncreased, true);
  assert.equal(record.current_streak, 1);
  assert.equal(record.longest_streak, 1);
  assert.equal(record.last_active_date, '2026-11-02');

  // 6th correct answer on same day is idempotent
  const sixth = registerDailyCorrectAnswer(record, true, day1Iso);
  record = sixth.newStreakRecord;
  assert.equal(sixth.streakIncreased, false);
  assert.equal(record.current_streak, 1);

  // Day 2 (Tuesday): 5 correct answers -> consecutive streak = 2!
  const day2Iso = '2026-11-03T03:00:00.000Z';
  for (let i = 0; i < 5; i++) {
    const res = registerDailyCorrectAnswer(record, true, day2Iso);
    record = res.newStreakRecord;
  }
  assert.equal(record.current_streak, 2);
  assert.equal(record.longest_streak, 2);
  assert.equal(record.last_active_date, '2026-11-03');

  // Day 3 (Wednesday): Skipped (con nghỉ 1 ngày)
  // Day 4 (Thursday): 5 correct answers -> uses Weekly Freeze! Streak advances to 3!
  const day4Iso = '2026-11-05T03:00:00.000Z';
  for (let i = 0; i < 5; i++) {
    const res = registerDailyCorrectAnswer(record, true, day4Iso);
    record = res.newStreakRecord;
  }
  assert.equal(record.current_streak, 3, 'Streak must advance to 3 with freeze used');
  assert.equal(record.freeze_used_week, getVietnamWeekKey('2026-11-05'));

  // Day 5 (Friday): Skipped (lại nghỉ thêm 1 ngày nữa trong cùng tuần)
  // Day 6 (Saturday): 5 correct answers -> freeze already used this week -> streak resets to 1!
  const day6Iso = '2026-11-07T03:00:00.000Z';
  for (let i = 0; i < 5; i++) {
    const res = registerDailyCorrectAnswer(record, true, day6Iso);
    record = res.newStreakRecord;
  }
  assert.equal(record.current_streak, 1, 'Streak must reset to 1 because freeze was already used this week');
  assert.equal(record.longest_streak, 3, 'Longest streak remains 3');
});

test('Streak computation handles inactive gap and displays status messages', () => {
  const activeRecord = {
    current_streak: 5,
    longest_streak: 5,
    last_active_date: '2026-11-04',
    freeze_used_week: null,
    today_correct_count: 2,
    today_date: '2026-11-05',
  };
  const state = computeStreakState(activeRecord, '2026-11-05T08:00:00.000Z');
  assert.equal(state.currentStreak, 5);
  assert.equal(state.todayCorrectCount, 2);
  assert.equal(state.todayQualified, false);
  assert.match(state.statusMessage, /Làm đúng thêm 3 câu/);

  // If student was active on Monday and today is Thursday (diff = 3 days)
  const brokenRecord = {
    current_streak: 5,
    longest_streak: 5,
    last_active_date: '2026-11-02',
    freeze_used_week: null,
    today_correct_count: 0,
    today_date: null,
  };
  const brokenState = computeStreakState(brokenRecord, '2026-11-05T08:00:00.000Z');
  assert.equal(brokenState.currentStreak, 0, 'Streak is broken after 3 days gap');
});

test('Badges: 12 catalog badges, missing requirements calculation and auto-award', () => {
  assert.equal(BADGE_CATALOG.length, 12, 'Catalog must contain exactly 12 initial badges');

  const earned = [
    {badgeId: 'first_lesson', unlockedAt: '2026-11-01T00:00:00.000Z'},
  ];
  const metrics = {
    streak: {currentStreak: 4, longestStreak: 4, lastActiveDate: null, freezeUsedWeek: null, todayCorrectCount: 0, todayQualified: false, canUseFreezeThisWeek: true, statusMessage: ''},
    retryFixedCount: 3,
    perfectMemoryCount: 0,
    perfectWeekCount: 0,
    distinctGamesPlayed: 2,
    consecutiveFirstTryCount: 5,
    completedPacksCount: 1,
    totalQuestionsAttempted: 25,
    mathPacks3Star: 1,
    vietnamesePacks3Star: 0,
    englishPacks3Star: 0,
  };

  const statuses = buildStudentBadgeStatuses(earned, metrics);
  assert.equal(statuses.length, 12);

  const first = statuses.find(s => s.id === 'first_lesson');
  assert.equal(first.unlocked, true);
  assert.equal(first.percent, 100);
  assert.equal(first.missingRequirement, 'Đã mở khóa huy hiệu!');

  const streak7 = statuses.find(s => s.id === 'streak_7');
  assert.equal(streak7.unlocked, false);
  assert.equal(streak7.currentProgress, 4);
  assert.equal(streak7.percent, 57);
  assert.match(streak7.missingRequirement, /Còn thiếu 3 ngày học liên tiếp nữa/);

  const fix10 = statuses.find(s => s.id === 'fix_10_errors');
  assert.equal(fix10.unlocked, false);
  assert.equal(fix10.currentProgress, 3);
  assert.match(fix10.missingRequirement, /Cần sửa đúng thêm 7 câu từng sai nữa/);
});

function createMemoryFixture(t) {
  const store = new OnlineStore(':memory:');
  t.after(() => store.close());
  const now = new Date().toISOString();
  const workspaceId = randomUUID();
  const adminUserId = randomUUID();
  store.db.prepare('INSERT INTO workspaces(id,name,wallet_enabled,rate_vnd,created_at) VALUES(?,?,?,?,?)').run(workspaceId, 'Trường Bảo An', 1, 1000, now);
  store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(adminUserId, workspaceId, 'admin_baoan', 'fixture-hash', 'admin', now);
  const admin = {id: adminUserId, workspaceId, role: 'admin', username: 'admin_baoan'};

  const cls = store.createClass(admin, {name: 'Lớp 3A', grade: 3});
  const student = store.createStudent(admin, {classId: cls.id, name: 'Bảo An', username: 'baoan3a'}, 'student-hash', 'baoan3a');
  const studentUser = store.db.prepare('SELECT * FROM users WHERE student_id=?').get(student.id);
  const studentAuth = {id: studentUser.id, workspaceId, role: 'student', studentId: student.id, username: 'baoan3a'};

  return {store, admin, cls, student, studentAuth};
}

test('OnlineStore SQLite: Streak advances on 5 correct attempts and updates daily missions', t => {
  const f = createMemoryFixture(t);

  // Initial streak and missions
  const initialStreak = f.store.studentStreak(f.studentAuth, f.student.id, '2026-11-05T08:00:00.000Z');
  assert.equal(initialStreak.currentStreak, 0);

  const missions = f.store.studentDailyMissions(f.studentAuth, f.student.id, '2026-11-05T08:00:00.000Z');
  assert.equal(missions.length, 3);
  assert.ok(missions.some(m => m.type === 'new_lesson'));
  assert.ok(missions.some(m => m.type === 'review_error'));
  assert.ok(missions.some(m => m.type === 'daily_riddle'));

  // 5 correct answers via recordDailyActivity
  for (let i = 1; i <= 5; i++) {
    f.store.recordDailyActivity(f.studentAuth, f.student.id, true, '2026-11-05T08:00:00.000Z');
  }

  const updatedStreak = f.store.studentStreak(f.studentAuth, f.student.id, '2026-11-05T08:00:00.000Z');
  assert.equal(updatedStreak.currentStreak, 1);
  assert.equal(updatedStreak.todayQualified, true);

  // Complete mission: new_lesson
  f.store.updateDailyMissionProgress(f.studentAuth, f.student.id, 'new_lesson', 1, '2026-11-05T09:00:00.000Z');
  const afterMission = f.store.studentDailyMissions(f.studentAuth, f.student.id, '2026-11-05T09:00:00.000Z');
  const newLessonMission = afterMission.find(m => m.type === 'new_lesson');
  assert.equal(newLessonMission.completed, true);
  assert.ok(newLessonMission.completedAt);
});

test('OnlineStore SQLite: Badges are awarded automatically upon reaching criteria and are idempotent', t => {
  const f = createMemoryFixture(t);

  // Award first_lesson manually
  const awarded = f.store.awardBadge(f.studentAuth, f.student.id, 'first_lesson', {reason: 'manual'}, '2026-11-05T00:00:00.000Z');
  assert.equal(awarded, true);

  // Re-awarding is idempotent
  const secondAward = f.store.awardBadge(f.studentAuth, f.student.id, 'first_lesson', {reason: 'duplicate'}, '2026-11-05T01:00:00.000Z');
  assert.equal(secondAward, false);

  const badges = f.store.studentBadges(f.studentAuth, f.student.id, '2026-11-05T01:00:00.000Z');
  const firstBadge = badges.find(b => b.id === 'first_lesson');
  assert.equal(firstBadge.unlocked, true);
  assert.equal(firstBadge.unlockedAt, '2026-11-05T00:00:00.000Z');
});

test('Regression CC8: Badges and missions preserve star balance strictly', t => {
  const f = createMemoryFixture(t);

  // Student awards initially 0
  const initialBalance = f.store.balance(f.studentAuth, f.student.id);
  assert.equal(initialBalance.earned, 0);

  // Advance streak to 7 and award multiple badges
  for (let i = 0; i < 7; i++) {
    f.store.recordDailyActivity(f.studentAuth, f.student.id, true, `2026-11-0${i + 1}T08:00:00.000Z`);
  }
  f.store.awardBadge(f.studentAuth, f.student.id, 'streak_7', {}, '2026-11-07T08:00:00.000Z');
  f.store.awardBadge(f.studentAuth, f.student.id, 'fix_10_errors', {}, '2026-11-07T08:00:00.000Z');

  // Complete missions
  f.store.updateDailyMissionProgress(f.studentAuth, f.student.id, 'new_lesson', 1, '2026-11-07T08:00:00.000Z');
  f.store.updateDailyMissionProgress(f.studentAuth, f.student.id, 'review_error', 1, '2026-11-07T08:00:00.000Z');

  // Balance MUST REMAIN EXACTLY 0!
  const finalBalance = f.store.balance(f.studentAuth, f.student.id);
  assert.equal(finalBalance.earned, 0, 'Badges and missions must never add arbitrary unbacked stars to wallet');
});

import {createPostgresFixture, authFor} from './helpers/postgres-fixture.mjs';

test('PostgresStore: Streak, Missions, Badges, and CC8 Star Preservation', async t => {
  const f = await createPostgresFixture(t);
  const cls = await f.store.createClass(f.admin, {name: 'Lớp 3B', grade: 3});
  const student = await f.store.createStudent(f.admin, {classId: cls.id, name: 'Bảo An', username: 'baoan_pg'}, 'salt:hash', 'baoan_pg');
  const user = await f.store.findUserByUsername('baoan_pg');
  const studentAuth = {id: user.id, workspaceId: f.admin.workspaceId, role: 'student', studentId: student.id, username: 'baoan_pg'};

  // 1. Initial streak & missions
  const initialStreak = await f.store.studentStreak(studentAuth, student.id);
  assert.equal(initialStreak.currentStreak, 0);

  const missions = await f.store.studentDailyMissions(studentAuth, student.id);
  assert.equal(missions.length, 3);

  // 2. 5 correct answers advance streak to 1
  for (let i = 0; i < 5; i++) {
    await f.store.recordDailyActivity(studentAuth, student.id, true, '2026-11-05T08:00:00.000Z');
  }
  const updatedStreak = await f.store.studentStreak(studentAuth, student.id, undefined, '2026-11-05T08:00:00.000Z');
  assert.equal(updatedStreak.currentStreak, 1);
  assert.equal(updatedStreak.todayQualified, true);

  // 3. Award badge on Postgres
  const firstAward = await f.store.awardBadge(studentAuth, student.id, 'streak_7', {}, '2026-11-05T08:00:00.000Z');
  assert.equal(firstAward, true);
  const duplicateAward = await f.store.awardBadge(studentAuth, student.id, 'streak_7', {}, '2026-11-05T08:00:00.000Z');
  assert.equal(duplicateAward, false);

  // 4. studentSummary returns all fields
  const summary = await f.store.studentSummary(studentAuth);
  assert.ok(summary.streak);
  assert.equal(summary.streak.currentStreak, 1);
  assert.ok(summary.badges);
  assert.equal(summary.badges.length, 12);
  const streak7 = summary.badges.find(b => b.id === 'streak_7');
  assert.equal(streak7.unlocked, true);
  assert.ok(summary.dailyMissions);
  assert.equal(summary.dailyMissions.length, 3);

  // 5. Star balance is strictly 0 (CC8)
  const balance = await f.store.balance(studentAuth, student.id);
  assert.equal(balance.earned, 0);
});
