import type { ContentPack, ModuleId, PairItem, QuizItem, SentenceItem } from './contracts.ts';
import { validateRichPack } from './rich-content.ts';

const validSubjects = new Set(['math', 'vietnamese', 'english', 'thinking']);
const limits = { title: 90, prompt: 320, answer: 120, explanation: 500 };
const moduleKinds: Record<ModuleId,ContentPack['kind']> = { 'math-quest':'quiz','memory-match':'pairs','sentence-builder':'sentences','word-connect':'pairs','sequence-trail':'sentences' };
const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

export function validatePack(pack: ContentPack): string[] {
  const errors: string[] = [];
  const metadataObject=(value:unknown,allowed:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
  const metadataText=(value:unknown,max=1000)=>typeof value==='string'&&!!value.trim()&&value.length<=max;
  if(pack.templateInfo!==undefined){const info=pack.templateInfo;
    if(!metadataObject(info,['schema','templateVersion','contentFormatVersion','topicId','source','rights','reviewStatus'])||info.schema!=='baoan-question-template'||info.templateVersion!==1||info.contentFormatVersion!==2
      ||!metadataText(info.topicId,120)||!metadataText(info.source)||!metadataText(info.rights)||!['draft','reviewed'].includes(info.reviewStatus))errors.push('Thông tin mẫu/nguồn/quyền sử dụng của bộ câu hỏi không hợp lệ.');
  }
  if (!pack.id || !/^[a-z0-9-]{3,80}$/.test(pack.id)) errors.push('Mã bộ học liệu chỉ được dùng chữ thường, số và dấu gạch nối.');
  if (!Number.isInteger(pack.version) || pack.version < 1) errors.push('Phiên bản nội dung không hợp lệ.');
  if (!pack.title.trim() || pack.title.trim().length > limits.title) errors.push('Tên học liệu phải có 1–90 ký tự.');
  if (!validSubjects.has(pack.subject)) errors.push('Môn học không hợp lệ.');
  if (!Number.isInteger(pack.grade) || pack.grade < 1 || pack.grade > 12) errors.push('Lớp học phải từ 1 đến 12.');
  if (!Array.isArray(pack.items) || pack.items.length < 2 || pack.items.length > 30) errors.push('Mỗi bộ phải có từ 2 đến 30 câu/cặp.');
  if (!['pairs', 'quiz', 'sentences','learning'].includes(pack.kind)) errors.push('Loại học liệu chưa được hỗ trợ.');
  if (!Array.isArray(pack.items)) return errors;
  const idSet = new Set<string>();
  const contentSet = new Set<string>();
  const cardFaceSet = new Set<string>();
  if(pack.kind==='learning')errors.push(...validateRichPack(pack));
  for (const [i, item] of pack.items.entries()) {
    const n = i + 1;
    if(item.media!==undefined){const media=item.media;
      if(!metadataObject(media,['imageId','imageAlt','audioId','audioTranscript'])||!media.imageId&&!media.audioId
        ||media.imageId!==undefined&&(typeof media.imageId!=='string'||!/^[A-Za-z0-9._:-]{1,120}$/.test(media.imageId)||!metadataText(media.imageAlt,500))
        ||media.audioId!==undefined&&(typeof media.audioId!=='string'||!/^[A-Za-z0-9._:-]{1,120}$/.test(media.audioId)||!metadataText(media.audioTranscript,8000))
        ||media.imageId===undefined&&media.imageAlt!==undefined||media.audioId===undefined&&media.audioTranscript!==undefined)errors.push(`Mục ${n}: hình/âm thanh cần mã tệp và văn bản thay thế hợp lệ.`);
    }
    if(item.metadata!==undefined){const info=item.metadata;
      if(!metadataObject(info,['knowledgeId','difficulty','contentRole','source','rights','reviewStatus','formId','topicId','level'])||!metadataText(info.knowledgeId,120)||!['easy','medium','hard'].includes(info.difficulty)
        ||!['unassigned','practice','assessment','review'].includes(info.contentRole)||!metadataText(info.source)||!metadataText(info.rights)||!['draft','reviewed'].includes(info.reviewStatus)
        ||info.formId!==undefined&&!metadataText(info.formId,120)||info.topicId!==undefined&&!metadataText(info.topicId,120)||info.level!==undefined&&!metadataText(info.level,120))errors.push(`Mục ${n}: metadata kiến thức/độ khó/nguồn/quyền/trạng thái không hợp lệ.`);
    }
    if (!item.id?.trim() || idSet.has(item.id)) errors.push(`Mục ${n}: mã câu hỏi thiếu hoặc trùng.`);
    if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(item.id ?? '')) errors.push(`Mục ${n}: mã câu hỏi chỉ dùng chữ, số, dấu chấm, gạch và gạch dưới.`);
    idSet.add(item.id);
    if (!item.objectiveId?.trim()) errors.push(`Mục ${n}: thiếu mã mục tiêu kiến thức.`);
    if(pack.kind==='learning')continue;
    if (pack.kind === 'pairs') {
      const pair = item as PairItem;
      if (pair.kind !== 'pair' || !pair.left?.trim() || !pair.right?.trim()) errors.push(`Cặp ${n}: cần cả hai mặt thẻ.`);
      if ((pair.left?.length ?? 0) > limits.answer || (pair.right?.length ?? 0) > limits.answer) errors.push(`Cặp ${n}: mỗi mặt tối đa 120 ký tự.`);
      const contentKey = `${norm(pair.left ?? '')}::${norm(pair.right ?? '')}`;
      if (contentSet.has(contentKey)) errors.push(`Cặp ${n}: nội dung bị trùng.`);
      contentSet.add(contentKey);
      for (const face of [pair.left ?? '',pair.right ?? '']) {
        const f = norm(face);
        if (f && cardFaceSet.has(f)) errors.push(`Cặp ${n}: nội dung mặt thẻ bị trùng, có thể khiến trò ghép cặp mơ hồ.`);
        cardFaceSet.add(f);
      }
    } else if (pack.kind === 'sentences') {
      const sentence = item as SentenceItem;
      if (sentence.kind !== 'sentence' || !sentence.prompt?.trim() || sentence.prompt.length > limits.prompt) errors.push(`Câu ${n}: yêu cầu sắp xếp trống hoặc quá dài.`);
      if (!Array.isArray(sentence.words) || sentence.words.length < 3 || sentence.words.length > 15
        || sentence.words.some(w => typeof w !== 'string' || !w.trim() || w.length > 45 || /\s/.test(w)))
        errors.push(`Câu ${n}: cần 3–15 từ, mỗi từ tối đa 45 ký tự và không chứa khoảng trắng.`);
      if (!sentence.hint?.trim() || sentence.hint.length > 160) errors.push(`Câu ${n}: cần gợi ý ngắn (tối đa 160 ký tự).`);
      const key = Array.isArray(sentence.words) ? norm(sentence.words.join(' ')) : '';
      if (contentSet.has(key)) errors.push(`Câu ${n}: câu hoàn chỉnh bị trùng.`);
      contentSet.add(key);
    } else {
      const quiz = item as QuizItem;
      if (quiz.kind !== 'multiple-choice' || !quiz.prompt?.trim() || quiz.prompt.length > limits.prompt) errors.push(`Câu ${n}: đề bài trống hoặc quá dài.`);
      if (!Array.isArray(quiz.options) || quiz.options.length !== 4 || quiz.options.some(o => !o?.trim() || o.length > limits.answer)) errors.push(`Câu ${n}: bắt buộc có 4 phương án không trống.`);
      if (!Number.isInteger(quiz.correctIndex) || quiz.correctIndex < 0 || quiz.correctIndex > 3) errors.push(`Câu ${n}: đáp án chính xác không hợp lệ.`);
      if (!quiz.explanation?.trim() || quiz.explanation.length > limits.explanation) errors.push(`Câu ${n}: thiếu lời giải hoặc lời giải quá dài.`);
      const key = norm(quiz.prompt ?? '');
      if (contentSet.has(key)) errors.push(`Câu ${n}: đề bài bị trùng.`);
      contentSet.add(key);
      if (quiz.options && new Set(quiz.options.map(norm)).size !== 4) errors.push(`Câu ${n}: có phương án giống nhau.`);
    }
  }
  return errors;
}

export function compatible(moduleId: ModuleId, pack: ContentPack): boolean {
  return moduleKinds[moduleId] === pack.kind;
}

export const packKey = (pack: Pick<ContentPack, 'id' | 'version'>) => `${pack.id}@${pack.version}`;
