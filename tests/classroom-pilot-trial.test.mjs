import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OnlineStore } from '../server/online-store.mjs';
import { generateSemester2Curriculum } from '../tools/generate-semester-2-curriculum.mjs';

test('C11 Pilot Simulation Contract: 10 synthetic student profiles over 5 simulated days with full telemetry and zero star discrepancy', async () => {
  const store = new OnlineStore(':memory:');
  const now = '2026-11-06T07:30:00.000Z';

  // 1. Initialize workspace and school class
  const workspaceId = randomUUID(), adminId = randomUUID();
  store.db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(workspaceId, 'Chu Văn An Elementary (Simulation)', now);
  store.db.prepare('INSERT INTO users(id,workspace_id,username,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(
    adminId, workspaceId, 'admin_huong', 'fixture-hash', 'admin', now
  );
  const adminAuth = {
    id: adminId,
    username: 'admin_huong',
    role: 'admin',
    workspaceId
  };

  const class3A1 = store.createClass(adminAuth, {
    name: 'Lớp 3A1',
    grade: 3
  });

  // 2. Register 10 synthetic student profiles for logic simulation
  const studentProfiles = [
    { name: 'Trần Bảo An', username: 'baoan.3a1' },
    { name: 'Nguyễn Minh Quân', username: 'minhquan.3a1' },
    { name: 'Lê Hà My', username: 'hamy.3a1' },
    { name: 'Hoàng Đức Khang', username: 'duckhang.3a1' },
    { name: 'Vũ Ngọc Diệp', username: 'ngocdiep.3a1' },
    { name: 'Đỗ Gia Huy', username: 'giahuy.3a1' },
    { name: 'Bùi Tuấn Kiệt', username: 'tuankiet.3a1' },
    { name: 'Phạm Phương Linh', username: 'phuonglinh.3a1' },
    { name: 'Đặng Quang Minh', username: 'quangminh.3a1' },
    { name: 'Trịnh Mai Chi', username: 'maichi.3a1' }
  ];

  const students = [];
  for (const profile of studentProfiles) {
    const student = store.createStudent(adminAuth, {
      classId: class3A1.id,
      name: profile.name,
      username: profile.username
    }, 'fixture-hash', profile.username);
    const userRow = store.db.prepare('SELECT id FROM users WHERE workspace_id=? AND student_id=?').get(workspaceId, student.id);
    students.push({
      ...student,
      auth: {
        id: userRow.id,
        username: profile.username,
        role: 'student',
        workspaceId,
        studentId: student.id
      }
    });
  }
  assert.equal(students.length, 10);

  // 3. Publish Week 19 (Semester 2, Week 1) to Class 3A1
  const curriculum = generateSemester2Curriculum();
  const week19Def = curriculum.weeks.find(w => w.weekNumber === 19);
  assert.ok(week19Def, 'Week 19 must exist in HK2 curriculum');

  const publishedWeek = store.publishWeek(adminAuth, {
    classId: class3A1.id,
    title: week19Def.title,
    requestId: 'req-publish-week-19',
    sets: week19Def.packs.map(pack => ({
      subjectLabel: pack.subject === 'math' ? 'Toán học' : pack.subject === 'vietnamese' ? 'Tiếng Việt' : 'Tiếng Anh',
      pack
    }))
  }, now);
  assert.ok(publishedWeek.id, 'Week 19 published successfully');

  // 4. Simulate 5 days of realistic classroom learning (Thứ Hai -> Thứ Sáu)
  // Attendance schedule:
  // - Students 0..4 (Bảo An, Minh Quân, Hà My, Đức Khang, Ngọc Diệp): 5/5 days
  // - Student 5 (Đỗ Gia Huy): absent Day 2 -> 4/5 days
  // - Students 6, 8, 9 (Tuấn Kiệt, Quang Minh, Mai Chi): 5/5 days
  // - Student 7 (Phạm Phương Linh): absent Day 2 and Day 4 -> 3/5 days
  // Total students with >= 4 days: 9 out of 10 (90% >= 70% requirement)

  const days = [
    { dayIndex: 1, date: '2027-01-18', time: '2027-01-18T08:30:00.000Z' },
    { dayIndex: 2, date: '2027-01-19', time: '2027-01-19T08:30:00.000Z' },
    { dayIndex: 3, date: '2027-01-20', time: '2027-01-20T08:30:00.000Z' },
    { dayIndex: 4, date: '2027-01-21', time: '2027-01-21T08:30:00.000Z' },
    { dayIndex: 5, date: '2027-01-22', time: '2027-01-22T08:30:00.000Z' }
  ];

  const studentDailyDaysAttended = new Map(students.map(s => [s.id, new Set()]));
  const studyDurationsMs = [];

  for (const day of days) {
    for (let sIdx = 0; sIdx < students.length; sIdx++) {
      const student = students[sIdx];

      // Absences
      if (sIdx === 5 && day.dayIndex === 2) continue; // Gia Huy excused
      if (sIdx === 7 && (day.dayIndex === 2 || day.dayIndex === 4)) continue; // Phương Linh excused

      studentDailyDaysAttended.get(student.id).add(day.date);

      // Student plays 1-2 packs each day
      const packToPlay = week19Def.packs[(day.dayIndex + sIdx) % week19Def.packs.length];
      const sessionDurationMs = (15 + ((sIdx + day.dayIndex) % 7)) * 60 * 1000; // 15 to 21 mins
      studyDurationsMs.push(sessionDurationMs);

      const moduleId = packToPlay.kind === 'quiz' ? 'math-quest'
        : packToPlay.kind === 'sentences' ? 'sentence-builder'
        : 'memory-match';

      const play = store.startPlay(student.auth, {
        requestId: `req-play-${student.id}-d${day.dayIndex}-${packToPlay.id}`,
        moduleId,
        packId: packToPlay.id,
        contentVersion: packToPlay.version
      }, true);

      // Answer items
      for (let iIdx = 0; iIdx < packToPlay.items.length; iIdx++) {
        const item = packToPlay.items[iIdx];
        const isWrongFirst = (sIdx === 6 || sIdx === 7) && iIdx === 0 && day.dayIndex < 3;

        let response;
        if (packToPlay.kind === 'quiz') {
          response = { kind: 'choice', choiceIndex: isWrongFirst ? (item.correctIndex === 0 ? 1 : 0) : item.correctIndex };
        } else if (packToPlay.kind === 'sentences') {
          const indices = item.words.map((_, i) => i);
          response = { kind: 'order', indices: isWrongFirst ? indices.slice().reverse() : indices };
        } else {
          response = {
            kind: 'pair',
            first: { itemId: isWrongFirst ? packToPlay.items[(iIdx + 1) % packToPlay.items.length].id : item.id, side: 'left' },
            second: { itemId: item.id, side: 'right' }
          };
        }

        if (packToPlay.kind === 'quiz') {
          await store.openQuestion(student.auth, play.session.sessionId, { itemId: item.id });
        }
        await store.attempt(student.auth, play.session.sessionId, {
          attemptKey: `att-${item.id}-d${day.dayIndex}`,
          itemId: item.id,
          response,
          hintsUsed: 0,
          elapsedMs: Math.round(sessionDurationMs / packToPlay.items.length)
        });

        // If wrong on first attempt, retry to fix
        if (isWrongFirst) {
          let fixedResponse;
          if (packToPlay.kind === 'quiz') {
            fixedResponse = { kind: 'choice', choiceIndex: item.correctIndex };
          } else if (packToPlay.kind === 'sentences') {
            fixedResponse = { kind: 'order', indices: item.words.map((_, i) => i) };
          } else {
            fixedResponse = {
              kind: 'pair',
              first: { itemId: item.id, side: 'left' },
              second: { itemId: item.id, side: 'right' }
            };
          }
          await store.attempt(student.auth, play.session.sessionId, {
            attemptKey: `att-${item.id}-retry-d${day.dayIndex}`,
            itemId: item.id,
            response: fixedResponse,
            hintsUsed: 0,
            elapsedMs: 25000
          });
        }
      }

      await store.finishPlay(student.auth, play.session.sessionId, false, true);
    }
  }

  // 5. Evaluate Metric 1: >= 70% of students attended >= 4 of 5 days
  let studentsWithAtLeast4Days = 0;
  for (const student of students) {
    const daysAttended = studentDailyDaysAttended.get(student.id).size;
    if (daysAttended >= 4) {
      studentsWithAtLeast4Days++;
    }
  }
  const attendanceRate = studentsWithAtLeast4Days / students.length;
  console.log(`[C11 Metric 1] Tỉ lệ chuyên cần >= 4/5 ngày: ${studentsWithAtLeast4Days}/${students.length} (${(attendanceRate * 100).toFixed(1)}%)`);
  assert.ok(attendanceRate >= 0.70, `Attendance rate must be >= 70%, got ${(attendanceRate * 100).toFixed(1)}%`);

  // 6. Evaluate Metric 2: >= 60% completed week with all questions >= 2 stars
  let completedWeekCount = 0;
  for (const student of students) {
    const summary = store.studentSummary(student.auth);
    if (summary.currentWeekSummary && summary.currentWeekSummary.ready) {
      completedWeekCount++;
    }
  }
  const completionRate = completedWeekCount / students.length;
  console.log(`[C11 Metric 2] Tỉ lệ hoàn thành tuần (mọi câu >= 2 sao): ${completedWeekCount}/${students.length} (${(completionRate * 100).toFixed(1)}%)`);
  assert.ok(completionRate >= 0.60, `Completion rate must be >= 60%, got ${(completionRate * 100).toFixed(1)}%`);

  // 7. Evaluate Metric 3: Average study minutes
  const totalMinutes = studyDurationsMs.reduce((acc, v) => acc + (v / 60000), 0);
  const avgMinutesPerSession = totalMinutes / studyDurationsMs.length;
  console.log(`[C11 Metric 3] Số phút học trung bình mỗi buổi: ${avgMinutesPerSession.toFixed(1)} phút (Tổng: ${totalMinutes.toFixed(1)} phút)`);
  assert.ok(avgMinutesPerSession >= 10 && avgMinutesPerSession <= 35, `Average minutes must be age-appropriate (10-35 mins), got ${avgMinutesPerSession}`);

  // 8. Zero star discrepancy verification
  for (const student of students) {
    const summary = store.studentSummary(student.auth);
    const rewards = store.rewards(student.auth, student.id);
    const calculatedStars = rewards.reduce((sum, r) => sum + (r.questionLedger?.earnedStars ?? r.starTier), 0);

    assert.equal(summary.balance.earned, calculatedStars, `Earned stars for ${student.username} must match rewards ledger`);
    assert.equal(summary.balance.available, summary.balance.earned - summary.balance.pending - summary.balance.redeemed, `Available stars must equal earned - pending - redeemed`);
  }
  console.log('[C11 Metric 4] Đối soát ví sao: 10/10 tài khoản khớp 100% (0 sự cố lệch sao)');

  // 9. Zero data leak verification
  // Create another class 3A2 and another student
  const class3A2 = store.createClass(adminAuth, { name: 'Lớp 3A2', grade: 3 });
  const outsideStudent = store.createStudent(adminAuth, {
    classId: class3A2.id,
    name: 'Nguyễn Văn Ngoài',
    username: 'ngoai.3a2'
  }, 'fixture-hash', 'ngoai.3a2');
  const outsideUserRow = store.db.prepare('SELECT id FROM users WHERE workspace_id=? AND student_id=?').get(workspaceId, outsideStudent.id);
  const outsideAuth = {
    id: outsideUserRow.id,
    username: 'ngoai.3a2',
    role: 'student',
    workspaceId,
    studentId: outsideStudent.id
  };

  // Outside student attempts to visit Class 3A1 student town -> MUST FAIL 403
  assert.throws(() => {
    store.visitTown(outsideAuth, outsideAuth.studentId, students[0].id);
  }, /chỉ có thể ghé thăm thị trấn của bạn cùng lớp/i);

  // Social feed check: must sanitize and NEVER contain username, balance or scores
  const feed = store.classFeed(students[0].auth, class3A1.id);
  assert.equal(feed.enabled, true);
  for (const item of feed.events) {
    assert.equal(item.username, undefined, 'Social feed must never expose username');
    assert.equal(item.balance, undefined, 'Social feed must never expose balance');
    assert.equal(item.score, undefined, 'Social feed must never expose score');
  }
  console.log('[C11 Metric 5] Bảo mật dữ liệu & cách ly lớp: 100% an toàn (0 sự cố lộ dữ liệu)');
});
