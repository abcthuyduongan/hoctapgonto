// server/contest-data.mjs
// Dữ liệu và logic xử lý thi thử Violympic & IOE phía server (Tuần 7 - Cổng C7)

import {
  CONTEST_PRESETS,
  CONTESTANT_BADGE,
  CONTEST_DISCLAIMER,
  VIOLYMPIC_MATH_POOL,
  IOE_ENGLISH_POOL,
  sanitizeContestItem,
  evaluateContestSubmission,
  checkReadinessForExam,
  selectContestQuestions
} from '../src/core/contest-matrix.ts';

export {
  CONTEST_PRESETS,
  CONTESTANT_BADGE,
  CONTEST_DISCLAIMER,
  sanitizeContestItem,
  evaluateContestSubmission,
  checkReadinessForExam
};

/**
 * Lấy danh sách câu hỏi cho một lượt thi thử của học sinh.
 * Sử dụng seed cố định theo sessionId và studentId để đảm bảo tính tất định khi tải lại trang,
 * đồng thời hai học sinh khác nhau sẽ nhận được đề khác nhau.
 */
export function generateContestQuestions(preset, studentId, sessionId, assignedPacks = []) {
  const basePool = preset.subject === 'math' ? [...VIOLYMPIC_MATH_POOL] : [...IOE_ENGLISH_POOL];

  // Nếu có gói bài đã giao phù hợp môn học, trích xuất thêm các câu hỏi trắc nghiệm/điền từ gói bài
  if (Array.isArray(assignedPacks)) {
    for (const pack of assignedPacks) {
      if (pack?.subject === preset.subject && Array.isArray(pack.items)) {
        for (const item of pack.items) {
          const isChoice = item?.kind === 'choice' || item?.kind === 'multiple-choice';
          const rawOptions = item?.options || item?.choices;
          if (isChoice && Array.isArray(rawOptions) && rawOptions.length >= 2 && item.prompt) {
            const options = rawOptions.map(c => typeof c === 'string' ? c : c?.text || '');
            const correctOpt = typeof rawOptions[item.correctIndex] === 'string'
              ? rawOptions[item.correctIndex]
              : rawOptions[item.correctIndex]?.text || options[0];
            basePool.push({
              id: `${pack.id}_${item.id}`,
              kind: 'choice',
              prompt: item.prompt,
              options,
              correctAnswer: correctOpt,
              explanation: item.explanation || `Đáp án đúng là: ${correctOpt}`
            });
          }
        }
      }
    }
  }

  const seed = `${studentId}:${preset.id}:${sessionId}`;
  const selected = selectContestQuestions(basePool, preset.totalQuestions, seed);

  // Xáo trộn vị trí các lựa chọn (options) cho từng câu hỏi trắc nghiệm theo seed của lượt thi
  return selected.map(item => {
    if (item.kind !== 'choice' || !Array.isArray(item.options) || item.options.length < 2) {
      return item;
    }
    const itemSeedKey = `${seed}:${item.id}:options`;
    let hashVal = 0;
    for (let i = 0; i < itemSeedKey.length; i++) {
      hashVal = (hashVal * 31 + itemSeedKey.charCodeAt(i)) >>> 0;
    }
    const shuffled = [...item.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      hashVal = (hashVal * 1664525 + 1013904223) >>> 0;
      const j = Math.floor((hashVal / 4294967296) * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return { ...item, options: shuffled };
  });
}

/**
 * Xây dựng gói học liệu ôn tập cho các câu làm sai trong bài thi.
 */
export function buildReviewMistakesPack(session, mistakes = []) {
  const cleanId = String(session.sessionId).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'contest';
  const packId = `review-${cleanId}`.slice(0, 40);
  const items = mistakes.map((m, idx) => {
    let options = Array.isArray(m.options) && m.options.length === 4
      ? m.options.map(String)
      : [String(m.correctAnswer), 'Phương án khác A', 'Phương án khác B', 'Phương án khác C'];
    const unique = Array.from(new Set(options));
    while (unique.length < 4) {
      unique.push(`Phương án phụ ${unique.length + 1}`);
    }
    options = unique.slice(0, 4);
    let correctIndex = options.indexOf(String(m.correctAnswer));
    if (correctIndex === -1) {
      options[0] = String(m.correctAnswer);
      correctIndex = 0;
    }
    return {
      id: `err-${idx + 1}`,
      kind: 'multiple-choice',
      objectiveId: 'CONTEST.REVIEW',
      prompt: m.prompt || `Câu hỏi số ${idx + 1}`,
      choices: options,
      options,
      correctIndex,
      explanation: m.explanation || `Đáp án đúng là: ${m.correctAnswer}`
    };
  });

  return {
    id: packId,
    version: 1,
    title: `Ôn tập câu sai - ${session.title || 'Thi thử'}`.slice(0, 90),
    kind: 'quiz',
    subject: session.subject || 'math',
    grade: Number.isInteger(session.grade) && session.grade >= 1 && session.grade <= 12 ? session.grade : 3,
    source: 'local',
    publishedAt: new Date().toISOString(),
    ownerStudentId: session.studentId || session.ownerStudentId,
    contestSessionId: session.sessionId,
    workspaceId: session.workspaceId,
    items: items.slice(0, 30)
  };
}
