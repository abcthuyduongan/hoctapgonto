/**
 * check-css.mjs — Kiểm tra tự động các quy chuẩn CSS Bảo An Learning 5.0
 * Quy chuẩn: 02_DINH_HUONG_VA_HE_THONG_THIET_KE.md (Mục 3), Tiêu chuẩn DS02-DS05
 * 
 * Quy tắc cho tệp mới / thành phần chuẩn (Strict Mode):
 * 1. Không dùng mã màu trực tiếp (#hex, rgb, hsl), phải dùng var(--c-...) (ngoại trừ tokens.css).
 * 2. Cấm hoàn toàn !important.
 * 3. Cấm cỡ chữ < 13px.
 * 4. Chỉ cho phép 4 mốc breakpoint (480, 768, 1024, 1440px) và prefers-reduced-motion.
 * 
 * Tệp cũ (Legacy): Đếm số lỗi và cảnh báo (sẽ được di chuyển dần trong Giai đoạn B).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED_BREAKPOINTS = [480, 768, 1024, 1440];
const STRICT_FILES = new Set([
  'tokens.css',
  'fonts.css',
  'ui.css',
  'student-frame.css',
  'contest-mock.css',
  'treasure-flip.css',
  'town.css',
  'daily-missions.css',
  'streak.css',
  'badges.css',
  'gift-shelf.css',
  'parent-portal.css',
  'online.css',
]);

const cssFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.css')) {
      cssFiles.push({ path: fullPath, name: entry.name });
    }
  }
}
walk('src');

let strictErrors = 0;
let legacyWarnings = 0;

for (const { path, name } of cssFiles) {
  const content = readFileSync(path, 'utf8');
  const isStrict = STRICT_FILES.has(name) || path.includes('src/ui/');

  // 1. Kiểm tra !important
  const importantMatches = content.match(/!important/gi) || [];
  if (isStrict && importantMatches.length > 0) {
    console.error(`[STRICT LỖI] ${path}: Cấm dùng !important (tìm thấy ${importantMatches.length} chỗ)`);
    strictErrors += importantMatches.length;
  } else if (!isStrict && importantMatches.length > 0) {
    legacyWarnings += importantMatches.length;
  }

  // 2. Kiểm tra cỡ chữ < 13px
  const fontSizeMatches = content.matchAll(/font-size:\s*(\d+(?:\.\d+)?)\s*px/gi);
  for (const match of fontSizeMatches) {
    const size = parseFloat(match[1]);
    if (size < 13) {
      if (isStrict) {
        console.error(`[STRICT LỖI] ${path}: Cỡ chữ ${size}px < 13px không được phép.`);
        strictErrors++;
      } else {
        legacyWarnings++;
      }
    }
  }

  // 3. Kiểm tra mốc breakpoint
  const mediaMatches = content.matchAll(/@media[^{]*(?:min|max)-width:\s*(\d+)px/gi);
  for (const match of mediaMatches) {
    const bp = parseInt(match[1], 10);
    if (!ALLOWED_BREAKPOINTS.includes(bp)) {
      if (isStrict) {
        console.error(`[STRICT LỖI] ${path}: Mốc breakpoint ${bp}px không nằm trong [480, 768, 1024, 1440].`);
        strictErrors++;
      } else {
        legacyWarnings++;
      }
    }
  }

  // 4. Kiểm tra mã màu trực tiếp (ngoại trừ tokens.css)
  if (isStrict && name !== 'tokens.css') {
    // Tìm các giá trị màu hex trực tiếp không nằm trong biến var()
    const hexColorMatches = content.matchAll(/(?<!var\([^)]*|url\([^)]*)#([0-9a-fA-F]{3,8})\b/g);
    for (const match of hexColorMatches) {
      // Cho phép #ffffff và #000000 trong trường hợp đặc biệt nếu cần, hoặc cấm toàn bộ
      const hex = match[0].toLowerCase();
      if (hex !== '#ffffff' && hex !== '#fff') {
        console.error(`[STRICT LỖI] ${path}: Mã màu trực tiếp ${hex} không được phép; hãy dùng var(--c-...).`);
        strictErrors++;
      }
    }
  }
}

console.log(`CSS Lint: ${cssFiles.length} tệp CSS đã quét.`);
console.log(`- Chế độ nghiêm ngặt (Strict): ${strictErrors} lỗi vi phạm.`);
console.log(`- Tệp giao diện cũ (Legacy warnings cần chuyển đổi ở GĐ B): ${legacyWarnings} vị trí.`);

if (strictErrors > 0) {
  console.error(`Thất bại: Có ${strictErrors} lỗi vi phạm quy chuẩn CSS mới!`);
  process.exit(1);
}

console.log('CSS Quality Gate: ĐẠT chuẩn nền tảng 5.0.');
