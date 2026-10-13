import type { ContentPack } from './contracts.ts';
import { packKey, validatePack } from './validation.ts';

export const CONTENT_SCHEMA = 'baoan-learning-content';
export const CONTENT_FORMAT_VERSION = 1;
export const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_PACKS = 40;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';

/** A strict boundary for teacher-authored material: never import student progress or execute text. */
export function parseContentImport(raw: string): ContentPack[] {
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) throw new Error('Tệp vượt quá giới hạn 1 MB.');
  let source: unknown;
  try {source = JSON.parse(raw);} catch {throw new Error('Tệp JSON không đọc được.');}
  if (!record(source) || source.schema !== CONTENT_SCHEMA || source.formatVersion !== CONTENT_FORMAT_VERSION || !Array.isArray(source.packs)) {
    throw new Error('Không đúng định dạng bộ học liệu Bảo An Learning phiên bản 1.');
  }
  if (source.packs.length < 1 || source.packs.length > MAX_PACKS) throw new Error('Mỗi tệp cần từ 1–40 bộ học liệu.');
  const keys = new Set<string>();
  return source.packs.map((row: unknown, i: number) => {
    if (!record(row) || !text(row.id) || !text(row.title) || !text(row.subject) ||
      !text(row.kind) || !Number.isInteger(row.version) || !Number.isInteger(row.grade) ||
      !Array.isArray(row.items) || row.items.some((item:unknown) => !record(item))) {
      throw new Error(`Bộ ${i + 1}: cấu trúc học liệu không hợp lệ.`);
    }
    const checked = {...row, source:'local', publishedAt:new Date().toISOString()} as ContentPack;
    // validatePack is written for typed content; this precheck avoids property access errors on untrusted JSON.
    for (const entry of checked.items) {
      const item: Record<string,unknown> = entry;
      if (!text(item.id) || !text(item.objectiveId)) throw new Error(`Bộ ${i + 1}: mã câu hỏi hoặc mục tiêu không hợp lệ.`);
      if (checked.kind === 'quiz' && (!text(item.prompt) || !text(item.explanation) || !Array.isArray(item.options) || item.options.some((o:unknown) => !text(o)))) throw new Error(`Bộ ${i + 1}: câu trắc nghiệm thiếu dữ liệu.`);
      if (checked.kind === 'pairs' && (!text(item.left) || !text(item.right))) throw new Error(`Bộ ${i + 1}: cặp từ thiếu dữ liệu.`);
      if (checked.kind === 'sentences' && (!text(item.prompt) || !text(item.hint) || !Array.isArray(item.words) || item.words.some((w:unknown) => !text(w)))) throw new Error(`Bộ ${i + 1}: ghép câu thiếu dữ liệu.`);
    }
    const problems = validatePack(checked);
    if (problems.length) throw new Error(`Bộ ${i + 1}: ${problems[0]}`);
    const key = packKey(checked);
    if (keys.has(key)) throw new Error(`Tệp chứa hai bộ trùng mã và phiên bản: ${key}.`);
    keys.add(key);
    return checked;
  });
}

/** Only curricula are exported. No sessions, personal data, event log or PIN. */
export function serializeContentExport(packs: ContentPack[], exportedAt = new Date().toISOString()): string {
  if (packs.length < 1 || packs.length > MAX_PACKS) throw new Error('Chọn từ 1–40 bộ học liệu.');
  packs.forEach((pack,i) => {
    const issues = validatePack(pack);
    if (issues.length) throw new Error(`Bộ ${i+1}: ${issues[0]}`);
  });
  return JSON.stringify({schema:CONTENT_SCHEMA,formatVersion:CONTENT_FORMAT_VERSION,exportedAt,
    packs:packs.map(pack => ({...pack,source:'local'}))},null,2);
}
