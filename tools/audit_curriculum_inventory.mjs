/**
 * Curriculum Inventory Audit Tool — CT01 / L11
 * Audits 8 weeks x 4 subjects x 12 questions matrix
 */

import fs from 'node:fs';
import path from 'node:path';

export function auditCurriculumInventory(filePath = 'data/curriculum/hoc-ky-2-8-tuan.json') {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Curriculum file not found: ${fullPath}`);
  }

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const subjects = ['math', 'vietnamese', 'english', 'informatics'];
  const weeks = data.weeks || [];

  const matrix = {};
  let totalQuestions = 0;

  for (const w of weeks) {
    matrix[w.weekNumber] = {};
    for (const s of subjects) {
      matrix[w.weekNumber][s] = 0;
    }
    for (const p of (w.packs || [])) {
      const count = (p.items || []).length;
      matrix[w.weekNumber][p.subject] = (matrix[w.weekNumber][p.subject] || 0) + count;
      totalQuestions += count;
    }
  }

  console.log('=== BẢNG KIỂM KÊ HỌC LIỆU 8 TUẦN × 4 MÔN (CT01) ===');
  console.log(`Nguồn: ${filePath}`);
  console.log(`Tổng số tuần: ${weeks.length}/8 | Tổng số câu hiện có: ${totalQuestions}/384 câu`);
  console.log('Tuần\tToán\tTiếng Việt\tTiếng Anh\tTin học\tTổng tuần');
  for (const w of weeks) {
    const row = matrix[w.weekNumber];
    const rowTotal = subjects.reduce((sum, s) => sum + (row[s] || 0), 0);
    console.log(`${w.weekNumber}\t${row.math || 0}\t${row.vietnamese || 0}\t\t${row.english || 0}\t\t${row.informatics || 0}\t${rowTotal}`);
  }

  const missingInfo = totalQuestions < 384;
  console.log('----------------------------------------------------');
  if (missingInfo) {
    console.log(`Trạng thái CT01: CẦN BỔ SUNG ${384 - totalQuestions} CÂU (gồm môn Tin học và các câu đạt chuẩn 12 câu/môn/tuần).`);
    console.log('Lưu ý: Theo yêu cầu chủ dự án, nội dung câu hỏi do giáo viên/chuyên môn cung cấp thực tế, không tự động sinh bằng AI.');
  } else {
    console.log('Trạng thái CT01: ĐẠT ĐỦ 384 CÂU TRÊN 8 TUẦN × 4 MÔN.');
  }

  return { matrix, totalQuestions, target: 384, metTarget: !missingInfo };
}

if (process.argv[1]?.endsWith('audit_curriculum_inventory.mjs')) {
  auditCurriculumInventory();
}
