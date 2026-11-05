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
          if (item?.kind === 'choice' && Array.isArray(item.choices) && item.prompt) {
            const options = item.choices.map(c => typeof c === 'string' ? c : c?.text || '');
            const correctOpt = typeof item.choices[item.correctIndex] === 'string'
              ? item.choices[item.correctIndex]
              : item.choices[item.correctIndex]?.text || options[0];
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
  return selectContestQuestions(basePool, preset.totalQuestions, seed);
}

/**
 * Xây dựng gói học liệu ôn tập cho các câu làm sai trong bài thi.
 */
export function buildReviewMistakesPack(session, mistakes) {
  const packId = `review_${session.sessionId.slice(0, 8)}`;
  const items = mistakes.map((m, idx) => {
    // Tạo câu hỏi trắc nghiệm ôn tập
    const options = [String(m.correctAnswer), 'Phương án khác A', 'Phương án khác B', 'Phương án khác C'];
    return {
      id: `err_${idx + 1}`,
      kind: 'choice',
      prompt: m.prompt,
      choices: options,
      correctIndex: 0,
      explanation: m.explanation
    };
  });

  return {
    id: packId,
    version: 1,
    title: `Ôn tập câu sai - ${session.title}`,
    kind: 'choice',
    subject: session.subject,
    grade: session.grade,
    items
  };
}
