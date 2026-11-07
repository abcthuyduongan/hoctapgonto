import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getVietnamTimeParts, msToMinutes } from '../src/core/parent-controls.ts';

export const PARENT_ELEVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_SERVER_SECRET = 'bao-an-parent-elevation-secret-key-2026';
const revokedTokens = new Set();
const revokedTimestamps = new Map();

export function hashParentPin(pin, salt = randomBytes(16).toString('hex')) {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('Mã PIN phụ huynh phải gồm từ 4 đến 6 chữ số.');
  }
  const pinHash = createHash('sha256').update(`${salt}:${pin}`).digest('hex');
  return { pinHash, pinSalt: salt };
}

export function verifyParentPin(pin, storedHash, storedSalt) {
  if (!/^\d{4,6}$/.test(pin)) return false;
  const computedHash = createHash('sha256').update(`${storedSalt}:${pin}`).digest('hex');
  return computedHash === storedHash;
}

export function issueParentElevationToken({ userId, studentId, workspaceId, pinHash, sessionHash = '', secretKey = DEFAULT_SERVER_SECRET, durationMs = PARENT_ELEVATION_TTL_MS }) {
  const now = Date.now();
  const expiresAt = now + durationMs;
  const tokenId = randomBytes(16).toString('hex');
  const payloadStr = [tokenId, userId, studentId, workspaceId, expiresAt, now].join('|');
  const hmacKey = `${secretKey}:${pinHash}:${sessionHash}`;
  const sig = createHash('sha256').update(`${payloadStr}:${hmacKey}`).digest('hex');
  return `${Buffer.from(payloadStr).toString('base64url')}.${sig}`;
}

export function verifyParentElevationToken(token, { userId, studentId, workspaceId, pinHash, sessionHash = '', secretKey = DEFAULT_SERVER_SECRET }) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  let payloadStr;
  try {
    payloadStr = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const [tokenId, tUserId, tStudentId, tWorkspaceId, tExpiresAtStr, tIssuedAtStr] = payloadStr.split('|');
  if (revokedTokens.has(tokenId)) return false;
  const revokedBefore = revokedTimestamps.get(`${userId}:${studentId}`) || 0;
  const issuedAt = Number(tIssuedAtStr) || 0;
  if (issuedAt < revokedBefore) return false;
  const expiresAt = Number(tExpiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (tUserId !== userId || tStudentId !== studentId || tWorkspaceId !== workspaceId) return false;
  const hmacKey = `${secretKey}:${pinHash}:${sessionHash}`;
  const expectedSig = createHash('sha256').update(`${payloadStr}:${hmacKey}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

export function revokeParentElevationToken(tokenOrKey) {
  if (!tokenOrKey) return;
  if (tokenOrKey.includes('.')) {
    try {
      const payloadStr = Buffer.from(tokenOrKey.split('.')[0], 'base64url').toString('utf8');
      const [tokenId] = payloadStr.split('|');
      if (tokenId) revokedTokens.add(tokenId);
    } catch {}
  } else {
    revokedTimestamps.set(tokenOrKey, Date.now());
  }
}

export function sanitizeParentControls(controls) {
  if (!controls) {
    return {
      workspaceId: '',
      studentId: '',
      hasPin: false,
      pinLocked: false,
      maxMinutesPerDay: 0,
      allowedStartHour: 0,
      allowedEndHour: 24,
      updatedAt: new Date().toISOString()
    };
  }
  const isLocked = Boolean(controls.pinLocked || (controls.pinLockedUntil && new Date(controls.pinLockedUntil).getTime() > Date.now()));
  return {
    workspaceId: controls.workspaceId || controls.workspace_id,
    studentId: controls.studentId || controls.student_id,
    hasPin: Boolean(controls.pinHash || controls.pin_hash || controls.hasPin),
    pinLocked: isLocked,
    maxMinutesPerDay: controls.maxMinutesPerDay ?? controls.max_minutes_per_day ?? 0,
    allowedStartHour: controls.allowedStartHour ?? controls.allowed_start_hour ?? 0,
    allowedEndHour: controls.allowedEndHour ?? controls.allowed_end_hour ?? 24,
    updatedAt: controls.updatedAt || controls.updated_at || new Date().toISOString()
  };
}

function wrongLabel(response) {
  if (!response || typeof response !== 'object') return '';
  if (response.kind === 'choice') return ['A', 'B', 'C', 'D'][response.choiceIndex] ?? '';
  if (response.kind === 'order' && Array.isArray(response.indices)) return response.indices.join('-');
  if (response.kind === 'compare') return String(response.operator ?? '');
  if (response.kind === 'categorize') return `${response.elementId}:${response.category}`;
  if (response.kind === 'pair' && response.first && response.second) return `${response.first.itemId} ↔ ${response.second.itemId}`;
  if (typeof response.answer === 'string') return response.answer;
  return '';
}

/**
 * Builds the comprehensive weekly report for a student.
 * Guarantees that first-try rates and item metrics match admin Excel export stats 100%.
 */
export function buildParentWeeklyReport({
  student,
  className,
  week,
  events, // array of event objects: { packId, itemId, occurredAt, elapsedMs, correct, response }
  badges = [], // array of { badge_id, unlocked_at, json }
  redemptions = [], // array of { id, json, status, requested_at }
  startDateIso,
  endDateIso,
}) {
  const dayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  
  // 1. Initialize 7 days of the week
  const start = new Date(startDateIso);
  const dailyStats = [];
  const dailyMinutesMap = new Map();
  const dailyCountMap = new Map();

  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const dayLabel = dayLabels[i];
    dailyStats.push({
      date: dateStr,
      dateStr,
      dayLabel,
      dayOfWeek: dayLabel,
      minutes: 0,
      studyMinutes: 0,
      questionsCount: 0,
      questionsCompleted: 0
    });
    dailyMinutesMap.set(dateStr, 0);
    dailyCountMap.set(dateStr, 0);
  }

  // 2. Aggregate events by question and calculate daily stats
  let totalElapsedMs = 0;
  const questionGroup = new Map(); // key -> list of events
  const wrongAnswersMap = new Map(); // itemId -> Map of (wrongAns -> count)
  const itemWrongCounts = new Map(); // itemId -> total wrong attempts

  for (const event of events) {
    if (!event || !event.occurredAt) continue;
    const vnDateStr = new Date(event.occurredAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    // Accumulate daily stats
    if (dailyMinutesMap.has(vnDateStr)) {
      const elapsed = Number.isFinite(event.elapsedMs) && event.elapsedMs > 0 ? event.elapsedMs : 0;
      dailyMinutesMap.set(vnDateStr, dailyMinutesMap.get(vnDateStr) + elapsed);
      dailyCountMap.set(vnDateStr, dailyCountMap.get(vnDateStr) + 1);
      totalElapsedMs += elapsed;
    }

    // Group events per item
    const key = `${event.packId}::${event.itemId}`;
    if (!questionGroup.has(key)) questionGroup.set(key, []);
    questionGroup.get(key).push(event);

    // Track wrong answers
    if (!event.correct) {
      itemWrongCounts.set(key, (itemWrongCounts.get(key) ?? 0) + 1);
      const label = wrongLabel(event.response);
      if (label) {
        if (!wrongAnswersMap.has(key)) wrongAnswersMap.set(key, new Map());
        const counts = wrongAnswersMap.get(key);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }

  // Populate daily stats array
  for (const stat of dailyStats) {
    const mins = msToMinutes(dailyMinutesMap.get(stat.date) ?? 0);
    const count = dailyCountMap.get(stat.date) ?? 0;
    stat.minutes = mins;
    stat.studyMinutes = mins;
    stat.questionsCount = count;
    stat.questionsCompleted = count;
  }

  // 3. Subject-level stats matching exportQuestionStats exactly
  const subjectMap = new Map(); // subjectLabel -> { subject, subjectLabel, questionsCount, firstTryCorrectCount }
  const itemLookup = new Map(); // key -> { item, subjectLabel }

  if (week && Array.isArray(week.sets)) {
    for (const set of week.sets) {
      const label = set.subjectLabel || 'Môn học';
      const subject = set.pack?.subject || 'thinking';
      if (!subjectMap.has(label)) {
        subjectMap.set(label, { subject, subjectLabel: label, questionsCount: 0, firstTryCorrectCount: 0 });
      }
      if (set.pack && Array.isArray(set.pack.items)) {
        for (const item of set.pack.items) {
          const packKey = `${set.pack.id}::${item.id}`;
          itemLookup.set(packKey, { item, subjectLabel: label });
          if (!itemLookup.has(item.id)) {
            itemLookup.set(item.id, { item, subjectLabel: label });
          }
        }
      }
    }
  }

  let totalQuestionsCompleted = 0;
  let totalFirstTryCorrect = 0;

  for (const [key, list] of questionGroup.entries()) {
    const [, itemId] = key.split('::');
    const sorted = list.sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)) || (a.gameSequence ?? 0) - (b.gameSequence ?? 0));
    const firstTryPassed = sorted[0]?.correct === true;
    totalQuestionsCompleted++;
    if (firstTryPassed) totalFirstTryCorrect++;

    const lookup = itemLookup.get(key) || itemLookup.get(itemId);
    if (lookup) {
      const sub = subjectMap.get(lookup.subjectLabel);
      if (sub) {
        sub.questionsCount++;
        if (firstTryPassed) sub.firstTryCorrectCount++;
      }
    }
  }

  const subjectStats = [...subjectMap.values()].map((s) => ({
    ...s,
    subjectLabel: s.subjectLabel,
    questionsAnswered: s.questionsCount,
    questionsCount: s.questionsCount,
    firstTryCorrect: s.firstTryCorrectCount,
    firstTryCorrectCount: s.firstTryCorrectCount,
    firstTryAccuracyPct: s.questionsCount > 0 ? Math.round((s.firstTryCorrectCount / s.questionsCount) * 100) : 100,
    firstTryRate: s.questionsCount > 0 ? Math.round((s.firstTryCorrectCount / s.questionsCount) * 100) : 100,
  }));

  const overallFirstTryRate = totalQuestionsCompleted > 0
    ? Math.round((totalFirstTryCorrect / totalQuestionsCompleted) * 100)
    : 100;

  // 4. Top 5 most frequent mistakes
  const sortedWrongItems = [...itemWrongCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topWrongQuestions = sortedWrongItems.map(([key, wrongCount]) => {
    const [, rawItemId] = key.includes('::') ? key.split('::') : ['', key];
    const itemId = rawItemId || key;
    const lookup = itemLookup.get(key) || itemLookup.get(itemId);
    const item = lookup?.item;
    const commonWrongMap = wrongAnswersMap.get(key) || wrongAnswersMap.get(itemId);
    let commonWrongAnswer = '';
    if (commonWrongMap && commonWrongMap.size > 0) {
      const topEntry = [...commonWrongMap.entries()].sort((a, b) => b[1] - a[1])[0];
      commonWrongAnswer = topEntry ? topEntry[0] : '';
    }

    const prompt = item?.prompt || (item?.left ? `${item.left} ↔ ${item.right}` : itemId);
    const correctAnswer = item?.explanation || (item?.answer ? String(item.answer) : '');

    return {
      itemId,
      prompt,
      subjectLabel: lookup?.subjectLabel || 'Toán học',
      wrongCount,
      errorCount: wrongCount,
      commonWrongAnswer,
      correctAnswer,
    };
  });

  // 5. New badges earned in this week
  const newBadges = badges.map((b) => {
    let parsedJson = {};
    try {
      parsedJson = typeof b.json === 'string' ? JSON.parse(b.json) : b.json || {};
    } catch {
      // ignore
    }
    return {
      id: b.badge_id,
      badgeId: b.badge_id,
      title: parsedJson.title || b.badge_id,
      description: parsedJson.description || '',
      icon: parsedJson.icon || '🏅',
      unlockedAt: b.unlocked_at,
      earnedAt: b.unlocked_at,
    };
  });

  // 6. Gifts redeemed in this week
  const redeemedGifts = redemptions.map((r) => {
    let parsedJson = {};
    try {
      parsedJson = typeof r.json === 'string' ? JSON.parse(r.json) : r.json || {};
    } catch {
      // ignore
    }
    return {
      id: r.id,
      requestId: r.id,
      title: parsedJson.title || 'Quà tặng',
      costStars: parsedJson.stars ?? parsedJson.costStars ?? 0,
      stars: parsedJson.stars ?? parsedJson.costStars ?? 0,
      ...(parsedJson.giftId?{giftId:parsedJson.giftId}:{}),
      ...(parsedJson.kind?{kind:parsedJson.kind}:{}),
      ...(Number.isSafeInteger(parsedJson.amountVnd)?{amountVnd:parsedJson.amountVnd,rateVnd:parsedJson.rateVnd,goalVnd:parsedJson.goalVnd}:{}),
      status: r.status,
      requestedAt: parsedJson.requestedAt || r.requested_at || '',
      note: parsedJson.history?.at(-1)?.note || parsedJson.note || r.note || '',
    };
  });

  const startDateStr = dailyStats[0]?.dateStr || '';
  const endDateStr = dailyStats[6]?.dateStr || '';

  return {
    weekTitle: week?.title || 'Tuần học',
    studentName: student?.name || 'Học sinh',
    className: className || '',
    startDate: startDateStr,
    startDateStr,
    endDate: endDateStr,
    endDateStr,
    totalStudyMinutes: msToMinutes(totalElapsedMs),
    totalQuestionsCompleted,
    overallFirstTryRate,
    overallFirstTryAccuracyPct: overallFirstTryRate,
    dailyStats,
    days: dailyStats,
    subjectStats,
    subjects: subjectStats,
    topWrongQuestions,
    topMistakes: topWrongQuestions,
    newBadges,
    redeemedGifts,
    redemptions: redeemedGifts,
  };
}
